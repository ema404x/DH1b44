import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

const tipoOptions = [
  { value: 'avance_obra', label: 'Avance de Obra' },
  { value: 'inspeccion', label: 'Inspección' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'financiero', label: 'Financiero' },
  { value: 'seguridad', label: 'Seguridad' },
  { value: 'final', label: 'Informe Final' },
  { value: 'otro', label: 'Otro' },
];

const estadoOptions = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_preparacion', label: 'En Preparación' },
  { value: 'enviado', label: 'Enviado' },
  { value: 'aprobado', label: 'Aprobado' },
  { value: 'rechazado', label: 'Rechazado' },
];

const prioridadOptions = [
  { value: 'baja', label: 'Baja' },
  { value: 'media', label: 'Media' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
];

export default function InformeFormDialog({ open, onOpenChange, initialData, onSave, saving }) {
  const [form, setForm] = useState({});



  useEffect(() => {
    if (open) {
      setForm(initialData || { tipo: 'mantenimiento', estado: 'pendiente', prioridad: 'media', requiere_firma: false, firma_obtenida: false });
    }
  }, [open, initialData]);

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = (e) => { e.preventDefault(); onSave(form); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Editar Informe' : 'Nuevo Informe'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Título *</Label>
              <Input value={form.titulo || ''} onChange={e => set('titulo', e.target.value)} required placeholder="Ej: Informe de avance - Semana 12" />
            </div>
            <div className="space-y-1.5">
              <Label>Código</Label>
              <Input value={form.codigo || ''} onChange={e => set('codigo', e.target.value)} placeholder="INF-001" />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Input value="Mantenimiento" disabled className="bg-muted" />
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={form.estado || ''} onValueChange={v => set('estado', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{estadoOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridad</Label>
              <Select value={form.prioridad || ''} onValueChange={v => set('prioridad', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{prioridadOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Responsable</Label>
              <Input value={form.responsable || ''} onChange={e => set('responsable', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha Límite de Entrega</Label>
              <Input type="date" value={form.fecha_limite || ''} onChange={e => set('fecha_limite', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha de Envío</Label>
              <Input type="date" value={form.fecha_envio || ''} onChange={e => set('fecha_envio', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha de Aprobación</Label>
              <Input type="date" value={form.fecha_aprobacion || ''} onChange={e => set('fecha_aprobacion', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Descripción</Label>
              <Textarea value={form.descripcion || ''} onChange={e => set('descripcion', e.target.value)} rows={2} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Observaciones</Label>
              <Textarea value={form.observaciones || ''} onChange={e => set('observaciones', e.target.value)} rows={2} />
            </div>

            <div className="col-span-2 flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm font-medium">Requiere firma</p>
                <p className="text-xs text-muted-foreground">El informe necesita firma del cliente</p>
              </div>
              <Switch checked={form.requiere_firma || false} onCheckedChange={v => set('requiere_firma', v)} />
            </div>

            {form.requiere_firma && (
              <div className="col-span-2 flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <div>
                  <p className="text-sm font-medium text-emerald-800">Firma obtenida</p>
                  <p className="text-xs text-emerald-600">Marcar cuando el cliente firmó</p>
                </div>
                <Switch checked={form.firma_obtenida || false} onCheckedChange={v => set('firma_obtenida', v)} />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}