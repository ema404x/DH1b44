import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Save, Loader2, MapPin, FileText, CheckSquare, Camera, PenTool, Package, Clock, DollarSign, Download, AlertTriangle, QrCode, Navigation } from 'lucide-react';
import { toast } from 'sonner';
import WorkOrderQRButton from './WorkOrderQRButton';
import QRCodeModal from '@/components/shared/QRCodeModal';
import DeleteWorkOrderButton from './DeleteWorkOrderButton';
import WorkOrderChecklist from './WorkOrderChecklist';
import WorkOrderPhotos from './WorkOrderPhotos';
import WorkOrderSignature from './WorkOrderSignature';
import WorkOrderMaterials from './WorkOrderMaterials';
import WorkOrderTimeLogs from './WorkOrderTimeLogs';
import WorkOrderCostSummary from './WorkOrderCostSummary';
import { exportWorkOrderPDF } from '@/utils/exportWorkOrderPDF';

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

export default function WorkOrderDetailPanel({ order, onClose, onDelete }) {
  const [data, setData] = useState({ ...order });
  const [qrOpen, setQrOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: timeLogs = [] } = useQuery({
    queryKey: ['timelogs', order.id],
    queryFn: () => base44.entities.TimeLog.filter({ work_order_id: order.id }),
    enabled: !!order.id,
  });

  const saveMutation = useMutation({
    mutationFn: (d) => base44.entities.WorkOrder.update(order.id, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workorders'] });
      toast.success('Orden de trabajo guardada');
    },
  });

  const set = (key, val) => setData(prev => ({ ...prev, [key]: val }));

  // Guarda inmediatamente — usa callback para tener el estado más reciente
  const saveField = (key, val) => {
    setData(prev => {
      const next = { ...prev, [key]: val };
      saveMutation.mutate(next);
      return next;
    });
  };

  const saveFields = (fields) => {
    setData(prev => {
      const next = { ...prev, ...fields };
      saveMutation.mutate(next);
      return next;
    });
  };

  // Checklist completion check
  const checklist = data.checklist || [];
  const pendingTasks = checklist.filter(t => !t.completed);
  const checklistBlocked = checklist.length > 0 && pendingTasks.length > 0;

  const handleStatusChange = (v) => {
    if (v === 'completada' && checklistBlocked) return; // blocked by checklist
    set('status', v);
  };

  const save = () => {
    if (checklistBlocked) {
      toast.warning(`Faltan ${pendingTasks.length} tarea(s) del checklist por completar`);
      return;
    }
    saveMutation.mutate(data);
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={() => {
        if (saveMutation.isPending) return;
        onClose();
      }} />
      <div className="w-full max-w-2xl bg-card shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {data.code && <span className="text-xs font-mono text-muted-foreground">{data.code}</span>}
              <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${priorityColors[data.priority]}`}>{data.priority}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{typeLabels[data.type]}</span>
            </div>
            <h2 className="text-lg font-bold leading-tight">{data.title}</h2>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
              {data.asset_name && <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{data.asset_name}</span>}
              {data.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{data.location}</span>}
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1"><X className="h-5 w-5" /></button>
        </div>

        {/* Quick fields */}
        <div className="p-4 border-b border-border bg-muted/30">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] uppercase text-muted-foreground mb-1">Estado</p>
              <Select value={data.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['pendiente','asignada','en_progreso','en_espera','completada','cancelada'].map(s => (
                    <SelectItem key={s} value={s} disabled={s === 'completada' && checklistBlocked} className="text-xs capitalize">
                      {s.replace(/_/g,' ')}{s === 'completada' && checklistBlocked ? ' 🔒' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {checklistBlocked && (
                <p className="text-[9px] text-orange-500 flex items-center gap-0.5 mt-0.5">
                  <AlertTriangle className="h-2.5 w-2.5" />{pendingTasks.length} tarea(s) pendiente(s)
                </p>
              )}
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

        {/* Tabs body */}
        <div className="flex-1 overflow-y-auto">
          <Tabs defaultValue="trabajo" className="h-full flex flex-col">
            <TabsList className="mx-4 mt-3 flex-shrink-0 grid grid-cols-5 h-8">
              <TabsTrigger value="trabajo" className="text-[10px] gap-1"><CheckSquare className="h-3 w-3" />Trabajo</TabsTrigger>
              <TabsTrigger value="materiales" className="text-[10px] gap-1"><Package className="h-3 w-3" />Materiales</TabsTrigger>
              <TabsTrigger value="horas" className="text-[10px] gap-1"><Clock className="h-3 w-3" />Horas</TabsTrigger>
              <TabsTrigger value="media" className="text-[10px] gap-1"><Camera className="h-3 w-3" />Media</TabsTrigger>
              <TabsTrigger value="costos" className="text-[10px] gap-1"><DollarSign className="h-3 w-3" />Costos</TabsTrigger>
            </TabsList>

            {/* Trabajo */}
            <TabsContent value="trabajo" className="flex-1 overflow-y-auto p-5 space-y-5 mt-0">
              {data.description && (
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Descripción</p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{data.description}</p>
                </div>
              )}
              <WorkOrderChecklist checklist={data.checklist || []} onChange={val => saveField('checklist', val)} />
              <hr className="border-border" />
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-3">Tiempo Estimado</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Horas estimadas</p>
                    <Input type="number" value={data.estimated_hours || ''} onChange={e => set('estimated_hours', parseFloat(e.target.value))} className="text-sm" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Horas reales</p>
                    <Input type="number" value={data.actual_hours || ''} onChange={e => set('actual_hours', parseFloat(e.target.value))} className="text-sm" />
                  </div>
                </div>
              </div>
              {/* GPS de campo */}
              {data.gps_status && (
                <>
                  <hr className="border-border" />
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Navigation className="h-3.5 w-3.5" /> Ubicación GPS de campo
                    </p>
                    {data.gps_status === 'capturado' ? (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-1.5">
                        <p className="text-sm font-medium text-emerald-800">
                          {data.gps_latitude?.toFixed(6)}, {data.gps_longitude?.toFixed(6)}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-emerald-600">
                          {data.gps_accuracy && <span>Precisión: {data.gps_accuracy}m</span>}
                          {data.gps_timestamp && <span>{new Date(data.gps_timestamp).toLocaleString('es-AR')}</span>}
                        </div>
                        <a
                          href={`https://www.google.com/maps?q=${data.gps_latitude},${data.gps_longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-emerald-700 underline flex items-center gap-1 mt-1"
                        >
                          <MapPin className="h-3 w-3" /> Ver en Google Maps
                        </a>
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-sm text-amber-700 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                          {data.gps_status === 'denegado' ? 'El operario denegó el permiso de ubicación' : 'Ubicación no disponible en el dispositivo'}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}

              <hr className="border-border" />
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Notas</p>
                <textarea
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[70px] resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Notas del trabajo..."
                  value={data.notes || ''}
                  onChange={e => set('notes', e.target.value)}
                />
              </div>
            </TabsContent>

            {/* Materiales */}
            <TabsContent value="materiales" className="flex-1 overflow-y-auto p-5 mt-0">
              <WorkOrderMaterials materials={data.materials_used || []} onChange={val => saveField('materials_used', val)} />
            </TabsContent>

            {/* Horas */}
            <TabsContent value="horas" className="flex-1 overflow-y-auto p-5 mt-0">
              <WorkOrderTimeLogs workOrderId={order.id} workOrderTitle={order.title} />
            </TabsContent>

            {/* Media */}
            <TabsContent value="media" className="flex-1 overflow-y-auto p-5 space-y-5 mt-0">
              <WorkOrderPhotos photos={data.photos || []} onChange={val => saveField('photos', val)} />
              <hr className="border-border" />
              <WorkOrderSignature
                signatureUrl={data.signature_url}
                signatureName={data.signature_name}
                onChange={({ signatureUrl, signatureName }) => {
                  saveFields({ signature_url: signatureUrl, signature_name: signatureName });
                }}
              />
            </TabsContent>

            {/* Costos */}
            <TabsContent value="costos" className="flex-1 overflow-y-auto p-5 mt-0">
              <WorkOrderCostSummary
                materials={data.materials_used || []}
                timeLogs={timeLogs}
                estimatedHours={data.estimated_hours}
                actualHours={data.actual_hours}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
         <div className="p-4 border-t border-border flex gap-2 flex-wrap justify-between">
           <div className="flex gap-2">
             <Button
               variant="outline"
               size="icon"
               className="flex-shrink-0"
               title="Exportar PDF"
               onClick={() => exportWorkOrderPDF(data, timeLogs)}
             >
               <Download className="h-4 w-4" />
             </Button>
             <WorkOrderQRButton order={data} variant="outline" size="icon" onShowQR={() => setQrOpen(true)} />
           </div>
           <div className="flex gap-2 flex-1 justify-end">
             {onDelete && (
               <DeleteWorkOrderButton order={data} onDelete={onDelete} />
             )}
             <Button
               className="gap-2"
               onClick={save}
               disabled={saveMutation.isPending || checklistBlocked}
               title={checklistBlocked ? `${pendingTasks.length} tarea(s) del checklist sin completar` : ''}
             >
               {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
               {checklistBlocked ? `Faltan ${pendingTasks.length} tarea(s)` : 'Guardar'}
             </Button>
             <Button variant="outline" onClick={onClose}>Cerrar</Button>
           </div>
         </div>
      </div>

      {/* QR Modal — una sola instancia por panel */}
      <QRCodeModal
       open={qrOpen}
       onClose={() => setQrOpen(false)}
       title={data.title}
       subtitle={data.location || data.asset_name || `OT ${data.code || ''}`}
       value={`${window.location.origin}/orden-trabajo?ot=${data.id}`}
      />
      </div>
      );
      }