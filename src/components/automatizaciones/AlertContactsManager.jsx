import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Mail, MessageCircle, Plus, Trash2, Edit2, Bell, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const ALERT_TYPES = [
  { id: 'ot_vencida',            label: 'OT Vencida' },
  { id: 'stock_bajo',            label: 'Stock Bajo' },
  { id: 'mantenimiento_vencido', label: 'Mant. Vencido' },
  { id: 'mantenimiento_proximo', label: 'Mant. Próximo' },
  { id: 'ot_urgente',            label: 'OT Urgente' },
];

const EMPTY_FORM = { name: '', type: 'email', value: '', active: true, alert_types: [] };

export default function AlertContactsManager() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: contacts = [] } = useQuery({
    queryKey: ['alert_contacts'],
    queryFn: () => base44.entities.AlertContact.list(),
  });

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.AlertContact.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alert_contacts'] }); closeDialog(); toast.success('Contacto agregado'); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, d }) => base44.entities.AlertContact.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alert_contacts'] }); closeDialog(); toast.success('Contacto actualizado'); },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.AlertContact.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alert_contacts'] }); toast.success('Contacto eliminado'); },
  });

  const toggleActiveMut = useMutation({
    mutationFn: ({ id, active }) => base44.entities.AlertContact.update(id, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alert_contacts'] }),
  });

  const openNew = () => { setEditing(null); setForm(EMPTY_FORM); setOpen(true); };
  const openEdit = (c) => { setEditing(c); setForm({ name: c.name, type: c.type, value: c.value, active: c.active, alert_types: c.alert_types || [] }); setOpen(true); };
  const closeDialog = () => { setOpen(false); setEditing(null); setForm(EMPTY_FORM); };

  const toggleAlertType = (id) => {
    setForm(f => ({
      ...f,
      alert_types: f.alert_types.includes(id) ? f.alert_types.filter(x => x !== id) : [...f.alert_types, id],
    }));
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.value.trim()) { toast.error('Completá nombre y dirección'); return; }
    if (form.type === 'email' && !form.value.includes('@')) { toast.error('Email inválido'); return; }
    if (form.type === 'whatsapp' && !form.value.startsWith('+')) { toast.error('El número debe empezar con + (ej: +5491112345678)'); return; }
    if (editing) {
      updateMut.mutate({ id: editing.id, d: form });
    } else {
      createMut.mutate(form);
    }
  };

  const activeCount = contacts.filter(c => c.active).length;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              Contactos de Alerta
            </CardTitle>
            {activeCount > 0 && (
              <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px]">
                {activeCount} activo{activeCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" /> Agregar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Reciben alertas por email o WhatsApp cuando se disparan las automatizaciones
        </p>
      </CardHeader>

      <CardContent>
        {contacts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="h-8 w-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm font-medium">Sin contactos configurados</p>
            <p className="text-xs mt-0.5">Agregá emails o WhatsApp para recibir alertas</p>
            <Button size="sm" variant="outline" className="mt-3 gap-1.5 text-xs" onClick={openNew}>
              <Plus className="h-3.5 w-3.5" /> Agregar primer contacto
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {contacts.map(c => (
              <div key={c.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${c.active ? 'border-border bg-card' : 'border-border/40 bg-muted/20 opacity-60'}`}>
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${c.type === 'email' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  {c.type === 'email' ? <Mail className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{c.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium uppercase">{c.type}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{c.value}</div>
                  {c.alert_types?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {c.alert_types.map(at => {
                        const found = ALERT_TYPES.find(x => x.id === at);
                        return found ? (
                          <span key={at} className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{found.label}</span>
                        ) : null;
                      })}
                    </div>
                  )}
                  {(!c.alert_types || c.alert_types.length === 0) && (
                    <span className="text-[10px] text-muted-foreground/60 italic">Recibe todas las alertas</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Switch
                    checked={!!c.active}
                    onCheckedChange={(v) => toggleActiveMut.mutate({ id: c.id, active: v })}
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEdit(c)}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteMut.mutate(c.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{editing ? 'Editar Contacto' : 'Nuevo Contacto de Alerta'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nombre *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Supervisor Juan" className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Canal *</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v, value: '' }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">📧 Email</SelectItem>
                    <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{form.type === 'email' ? 'Dirección de email *' : 'Número WhatsApp * (con código país)'}</Label>
              <Input
                value={form.value}
                onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                placeholder={form.type === 'email' ? 'nombre@empresa.com' : '+5491112345678'}
                className="h-8 text-sm"
              />
              {form.type === 'whatsapp' && (
                <p className="text-[10px] text-amber-600 bg-amber-50 px-2 py-1.5 rounded-md">
                  ⚠️ WhatsApp requiere integración con Twilio o Meta Business API. El sistema registrará el intento.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Tipos de alerta a recibir <span className="text-muted-foreground">(vacío = todas)</span></Label>
              <div className="flex flex-wrap gap-2">
                {ALERT_TYPES.map(at => (
                  <button
                    key={at.id}
                    type="button"
                    onClick={() => toggleAlertType(at.id)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-all ${
                      form.alert_types.includes(at.id)
                        ? 'bg-primary text-white border-primary'
                        : 'bg-muted text-muted-foreground border-border hover:border-primary/50'
                    }`}
                  >
                    {form.alert_types.includes(at.id) && <CheckCircle2 className="h-3 w-3 inline mr-1" />}
                    {at.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={closeDialog}>Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
                {editing ? 'Guardar Cambios' : 'Agregar Contacto'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}