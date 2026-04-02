import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Save, Loader2, MapPin, User, Calendar, Clock, FileText } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import WorkOrderChecklist from './WorkOrderChecklist';
import WorkOrderPhotos from './WorkOrderPhotos';
import WorkOrderSignature from './WorkOrderSignature';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const priorityColors = {
  baja: 'bg-slate-100 text-slate-600',
  media: 'bg-blue-100 text-blue-700',
  alta: 'bg-orange-100 text-orange-700',
  urgente: 'bg-red-100 text-red-700 font-bold',
};

const typeLabels = {
  mantenimiento_preventivo: 'Preventivo', mantenimiento_correctivo: 'Correctivo',
  instalacion: 'Instalación', inspeccion: 'Inspección', reparacion: 'Reparación', emergencia: 'Emergencia'
};

export default function WorkOrderDetailPanel({ order, onClose }) {
  const [data, setData] = useState({ ...order });
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: (d) => base44.entities.WorkOrder.update(order.id, d),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workorders'] }),
  });

  const set = (key, val) => setData(prev => ({ ...prev, [key]: val }));
  const save = () => saveMutation.mutate(data);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-xl bg-card shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-muted-foreground">{data.code || 'OT'}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${priorityColors[data.priority]}`}>{data.priority}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{typeLabels[data.type]}</span>
            </div>
            <h2 className="text-lg font-bold leading-tight">{data.title}</h2>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              {data.asset_name && <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{data.asset_name}</span>}
              {data.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{data.location}</span>}
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        {/* Quick status & fields */}
        <div className="p-4 border-b border-border bg-muted/30">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] uppercase text-muted-foreground mb-1">Estado</p>
              <Select value={data.status} onValueChange={v => set('status', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['pendiente','asignada','en_progreso','en_espera','completada','cancelada'].map(s => (
                    <SelectItem key={s} value={s} className="text-xs capitalize">{s.replace('_',' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground mb-1">Asignado</p>
              <Input value={data.assigned_name || ''} onChange={e => set('assigned_name', e.target.value)} className="h-8 text-xs" placeholder="Técnico" />
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground mb-1">Fecha</p>
              <Input type="date" value={data.scheduled_date || ''} onChange={e => set('scheduled_date', e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {data.description && (
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Descripción</p>
              <p className="text-sm text-foreground/80 leading-relaxed">{data.description}</p>
            </div>
          )}

          <WorkOrderChecklist
            checklist={data.checklist || []}
            onChange={val => set('checklist', val)}
          />

          <hr className="border-border" />

          <WorkOrderPhotos
            photos={data.photos || []}
            onChange={val => set('photos', val)}
          />

          <hr className="border-border" />

          <WorkOrderSignature
            signatureUrl={data.signature_url}
            signatureName={data.signature_name}
            onChange={({ signatureUrl, signatureName }) => {
              setData(prev => ({ ...prev, signature_url: signatureUrl, signature_name: signatureName }));
            }}
          />

          <hr className="border-border" />

          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Horas</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Estimadas</p>
                <Input type="number" value={data.estimated_hours || ''} onChange={e => set('estimated_hours', parseFloat(e.target.value))} className="text-sm" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Reales</p>
                <Input type="number" value={data.actual_hours || ''} onChange={e => set('actual_hours', parseFloat(e.target.value))} className="text-sm" />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <Button className="w-full gap-2" onClick={save} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar Cambios
          </Button>
        </div>
      </div>
    </div>
  );
}