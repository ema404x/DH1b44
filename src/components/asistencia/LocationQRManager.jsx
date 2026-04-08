import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, QrCode, MapPin, Pencil, Trash2, LogIn, LogOut, ArrowLeftRight, Building2, Scan } from 'lucide-react';
import QRCodeModal from '@/components/shared/QRCodeModal';

const COLOR_OPTIONS = [
  { value: 'blue',   label: 'Azul',     dot: 'bg-blue-500' },
  { value: 'green',  label: 'Verde',    dot: 'bg-emerald-500' },
  { value: 'purple', label: 'Violeta',  dot: 'bg-purple-500' },
  { value: 'orange', label: 'Naranja',  dot: 'bg-orange-500' },
  { value: 'red',    label: 'Rojo',     dot: 'bg-red-500' },
];

const EVENT_LABELS = {
  entrada: { label: 'Solo Entrada', icon: LogIn, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  salida:  { label: 'Solo Salida',  icon: LogOut, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  ambos:   { label: 'Entrada & Salida', icon: ArrowLeftRight, color: 'text-slate-600 bg-slate-50 border-slate-200' },
};

const emptyForm = { name: '', description: '', address: '', project_name: '', event_type: 'ambos', color: 'blue', is_active: true };

export default function LocationQRManager() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [qrLoc, setQrLoc] = useState(null);

  const { data: locations = [] } = useQuery({
    queryKey: ['locationQRs'],
    queryFn: () => base44.entities.LocationQR.list('-created_date', 100),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editing
      ? base44.entities.LocationQR.update(editing.id, data)
      : base44.entities.LocationQR.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['locationQRs'] }); setDialogOpen(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.LocationQR.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['locationQRs'] }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, val }) => base44.entities.LocationQR.update(id, { is_active: val }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['locationQRs'] }),
  });

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (loc) => { setEditing(loc); setForm({ ...loc }); setDialogOpen(true); };
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const getQRUrl = (loc) => `${window.location.origin}/fichar-ubicacion?loc=${loc.id}`;

  const dotColor = COLOR_OPTIONS.find(c => c.value === form.color)?.dot || 'bg-blue-500';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">QRs por Ubicación</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Generá QRs para obras, depósitos o cualquier punto de trabajo</p>
        </div>
        <Button size="sm" onClick={openNew} className="gap-1.5">
          <Plus className="h-4 w-4" /> Nueva Ubicación
        </Button>
      </div>

      {/* Cards grid */}
      {locations.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl py-12 text-center">
          <MapPin className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="font-medium text-sm text-muted-foreground">Sin ubicaciones configuradas</p>
          <p className="text-xs text-muted-foreground/70 mt-1 mb-4">Creá un punto de fichaje y generá su QR</p>
          <Button size="sm" variant="outline" onClick={openNew} className="gap-1.5">
            <Plus className="h-4 w-4" /> Crear primera ubicación
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {locations.map(loc => {
            const eventCfg = EVENT_LABELS[loc.event_type] || EVENT_LABELS.ambos;
            const colorDot = COLOR_OPTIONS.find(c => c.value === loc.color)?.dot || 'bg-blue-500';
            return (
              <Card key={loc.id} className={`overflow-hidden transition-all ${!loc.is_active ? 'opacity-60' : ''}`}>
                {/* Color accent top */}
                <div className={`h-1.5 w-full ${colorDot}`} />
                <CardContent className="pt-4 pb-4 px-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`h-9 w-9 rounded-lg ${colorDot.replace('bg-', 'bg-').replace('500', '100')} flex items-center justify-center flex-shrink-0`}>
                        <Building2 className={`h-4.5 w-4.5 ${colorDot.replace('bg-', 'text-')}`} />
                      </div>
                      <div>
                        <p className="font-semibold text-sm leading-tight">{loc.name}</p>
                        {loc.project_name && <p className="text-xs text-muted-foreground">{loc.project_name}</p>}
                      </div>
                    </div>
                    <Switch
                      checked={!!loc.is_active}
                      onCheckedChange={val => toggleActiveMutation.mutate({ id: loc.id, val })}
                      className="scale-75"
                    />
                  </div>

                  {loc.address && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{loc.address}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className={`text-[10px] gap-1 ${eventCfg.color}`}>
                        <eventCfg.icon className="h-3 w-3" />
                        {eventCfg.label}
                      </Badge>
                      {loc.total_scans > 0 && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Scan className="h-3 w-3" />{loc.total_scans}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => setQrLoc(loc)} title="Ver QR">
                        <QrCode className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(loc)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar ubicación?</AlertDialogTitle>
                            <AlertDialogDescription>Se eliminará el punto de fichaje y su QR dejará de funcionar.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(loc.id)}>Eliminar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* QR Modal */}
      <QRCodeModal
        open={!!qrLoc}
        onClose={() => setQrLoc(null)}
        title={qrLoc?.name || ''}
        subtitle={qrLoc?.address || qrLoc?.project_name || 'Punto de fichaje'}
        value={qrLoc ? getQRUrl(qrLoc) : ''}
      />

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Ubicación' : 'Nueva Ubicación'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre *</Label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej: Obra Norte, Depósito Central" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Dirección</Label>
              <Input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Av. Corrientes 1234, CABA" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Proyecto asociado</Label>
              <Input value={form.project_name} onChange={e => set('project_name', e.target.value)} placeholder="Nombre del proyecto (opcional)" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de fichaje</Label>
                <Select value={form.event_type} onValueChange={v => set('event_type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ambos">Entrada & Salida</SelectItem>
                    <SelectItem value="entrada">Solo Entrada</SelectItem>
                    <SelectItem value="salida">Solo Salida</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Color</Label>
                <Select value={form.color} onValueChange={v => set('color', v)}>
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      <div className={`h-3 w-3 rounded-full ${dotColor}`} />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {COLOR_OPTIONS.map(c => (
                      <SelectItem key={c.value} value={c.value}>
                        <div className="flex items-center gap-2">
                          <div className={`h-3 w-3 rounded-full ${c.dot}`} />
                          {c.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <div>
                <Label className="text-sm font-medium">Activo</Label>
                <p className="text-xs text-muted-foreground">El QR estará operativo para fichajes</p>
              </div>
              <Switch checked={!!form.is_active} onCheckedChange={v => set('is_active', v)} />
            </div>
          </div>
          <div className="flex gap-2 pt-2 border-t">
            <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending || !form.name}>
              {editing ? 'Guardar cambios' : 'Crear ubicación'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}