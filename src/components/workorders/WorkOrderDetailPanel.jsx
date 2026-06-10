import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  X, Save, Loader2, MapPin, FileText, CheckSquare, Camera,
  Package, Clock, DollarSign, Download, AlertTriangle, Navigation,
  Layers, ClipboardX, Wrench, Zap, ClipboardList, User, RefreshCw,
  CheckCircle2, Circle
} from 'lucide-react';
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
import WorkOrderIncompleteReason from './WorkOrderIncompleteReason';
import { exportWorkOrderPDF } from '@/utils/exportWorkOrderPDF';

const PRIORITY_CONFIG = {
  baja:    { label: 'Baja',     color: 'bg-slate-500/20 text-slate-300 border-slate-500/40' },
  media:   { label: 'Media',    color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  alta:    { label: 'Alta',     color: 'bg-orange-500/20 text-orange-300 border-orange-500/40' },
  urgente: { label: '🚨 Urgente', color: 'bg-red-500/20 text-red-300 border-red-500/40' },
};

const STATUS_CONFIG = {
  pendiente:   { label: 'Pendiente',   color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' },
  asignada:    { label: 'Asignada',    color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  en_progreso: { label: 'En Progreso', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
  en_espera:   { label: 'En Espera',   color: 'bg-slate-500/20 text-slate-300 border-slate-500/40' },
  completada:  { label: 'Completada',  color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  cancelada:   { label: 'Cancelada',   color: 'bg-red-500/20 text-red-300 border-red-500/40' },
};

const TYPE_LABELS = {
  mantenimiento_preventivo: 'Preventivo',
  mantenimiento_correctivo: 'Correctivo',
  instalacion: 'Instalación',
  inspeccion: 'Inspección',
  reparacion: 'Reparación',
  emergencia: 'Emergencia',
};

export default function WorkOrderDetailPanel({ order, onClose, onDelete }) {
  const [data, setData] = useState({ ...order });
  const [qrOpen, setQrOpen] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const queryClient = useQueryClient();

  // ── Fetch fresco desde el servidor — siempre al abrir ──────────────────────
  const { data: freshOrder, isLoading: loadingFresh, refetch } = useQuery({
    queryKey: ['workorder-detail', order.id],
    queryFn: async () => {
      const results = await base44.entities.WorkOrder.filter({ id: order.id });
      return results[0] || order;
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  useEffect(() => {
    if (freshOrder) setData({ ...freshOrder });
  }, [freshOrder]);

  // ── Employees ──────────────────────────────────────────────────────────────
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('full_name', 200),
    staleTime: 1000 * 60 * 10,
  });
  const activeEmployees = employees.filter(e => e.status === 'activo' || !e.status);

  // ── Time logs ──────────────────────────────────────────────────────────────
  const { data: timeLogs = [] } = useQuery({
    queryKey: ['timelogs', order.id],
    queryFn: () => base44.entities.TimeLog.filter({ work_order_id: order.id }),
    enabled: !!order.id,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (d) => base44.entities.WorkOrder.update(order.id, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workorders'] });
      queryClient.invalidateQueries({ queryKey: ['workorder-detail', order.id] });
      toast.success('Orden guardada');
    },
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const set = useCallback((key, val) => setData(prev => ({ ...prev, [key]: val })), []);

  const saveTimerRef = useRef(null);
  const latestDataRef = useRef(data);
  useEffect(() => { latestDataRef.current = data; }, [data]);
  useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); }, []);

  const saveField = useCallback((key, val) => {
    setData(prev => {
      const next = { ...prev, [key]: val };
      latestDataRef.current = next;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => saveMutation.mutate(next), 300);
      return next;
    });
  }, [saveMutation]);

  const saveFields = useCallback((fields) => {
    setData(prev => {
      const next = { ...prev, ...fields };
      latestDataRef.current = next;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => saveMutation.mutate(next), 300);
      return next;
    });
  }, [saveMutation]);

  const handleSaveAsTemplate = async () => {
    const nombre = prompt('Nombre de la plantilla:', data.title);
    if (!nombre) return;
    setSavingTemplate(true);
    try {
      await base44.entities.OTTemplate.create({
        nombre, title: data.title, type: data.type, priority: data.priority,
        description: data.description, estimated_hours: data.estimated_hours,
        checklist: (data.checklist || []).map(t => ({ ...t, completed: false })),
        require_photos: (data.photos || []).length > 0,
      });
      queryClient.invalidateQueries({ queryKey: ['ot-templates'] });
      toast.success('Plantilla guardada');
    } finally {
      setSavingTemplate(false);
    }
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  const checklist = data.checklist || [];
  const pendingTasks = checklist.filter(t => !t.completed);
  const checklistBlocked = checklist.length > 0 && pendingTasks.length > 0;
  const photosBlocked = data.require_photos && (data.photos || []).length === 0;
  const canComplete = !checklistBlocked && !photosBlocked;

  const handleStatusChange = (v) => {
    if (v === 'completada' && !canComplete) return;
    set('status', v);
  };

  const save = () => {
    if (checklistBlocked) { toast.warning(`Faltan ${pendingTasks.length} tarea(s) del checklist`); return; }
    if (photosBlocked) { toast.warning('Falta foto obligatoria'); return; }
    saveMutation.mutate(data);
  };

  const statusCfg = STATUS_CONFIG[data.status] || STATUS_CONFIG.pendiente;
  const priorityCfg = PRIORITY_CONFIG[data.priority] || PRIORITY_CONFIG.media;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => { if (!saveMutation.isPending) onClose(); }} />

      {/* Panel */}
      <div className="w-full max-w-2xl bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl flex flex-col overflow-hidden border-l border-slate-700/50">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="relative bg-gradient-to-r from-purple-900/40 via-slate-900/60 to-slate-900 border-b border-slate-700/50 p-5">
          {/* Sync indicator */}
          {loadingFresh && (
            <div className="absolute top-3 right-12 flex items-center gap-1.5 text-xs text-slate-400">
              <Loader2 className="h-3 w-3 animate-spin" /> Sincronizando...
            </div>
          )}

          <button
            onClick={() => refetch()}
            title="Recargar desde servidor"
            className="absolute top-3 right-14 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingFresh ? 'animate-spin' : ''}`} />
          </button>

          <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors p-1">
            <X className="h-5 w-5" />
          </button>

          {/* Icon + Title */}
          <div className="flex items-start gap-4 pr-16">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-500/30">
              <Wrench className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              {data.code && (
                <p className="text-xs font-mono text-slate-500 mb-0.5">{data.code}</p>
              )}
              <h2 className="text-lg font-bold text-white leading-tight">{data.title}</h2>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${priorityCfg.color}`}>
                  {priorityCfg.label}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full border border-slate-600/50 bg-slate-700/30 text-slate-300">
                  {TYPE_LABELS[data.type] || data.type}
                </span>
                <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${statusCfg.color}`}>
                  {statusCfg.label}
                </span>
              </div>
            </div>
          </div>

          {/* Meta info chips */}
          <div className="flex items-center gap-3 mt-3 text-xs text-slate-400 flex-wrap">
            {data.location && (
              <span className="flex items-center gap-1.5 bg-slate-800/60 rounded-lg px-2.5 py-1 border border-slate-700/50">
                <MapPin className="h-3 w-3 text-primary" /> {data.location}
              </span>
            )}
            {data.location_qr_name && data.location_qr_name !== data.location && (
              <span className="flex items-center gap-1.5 bg-slate-800/60 rounded-lg px-2.5 py-1 border border-slate-700/50">
                <Zap className="h-3 w-3 text-yellow-400" /> {data.location_qr_name}
              </span>
            )}
            {data.assigned_name && (
              <span className="flex items-center gap-1.5 bg-slate-800/60 rounded-lg px-2.5 py-1 border border-slate-700/50">
                <User className="h-3 w-3 text-emerald-400" /> {data.assigned_name}
              </span>
            )}
            {data.scheduled_date && (
              <span className="flex items-center gap-1.5 bg-slate-800/60 rounded-lg px-2.5 py-1 border border-slate-700/50">
                <Clock className="h-3 w-3 text-blue-400" /> {data.scheduled_date}
              </span>
            )}
          </div>
        </div>

        {/* ── Quick fields ────────────────────────────────────────────────── */}
        <div className="px-5 py-3 bg-slate-900/80 border-b border-slate-700/50">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] uppercase text-slate-500 font-semibold mb-1.5 tracking-wide">Estado</p>
              <Select value={data.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="h-8 text-xs bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                    <SelectItem key={val} value={val} disabled={val === 'completada' && checklistBlocked} className="text-xs">
                      {cfg.label}{val === 'completada' && checklistBlocked ? ' 🔒' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {checklistBlocked && (
                <p className="text-[9px] text-orange-400 flex items-center gap-0.5 mt-0.5">
                  <AlertTriangle className="h-2.5 w-2.5" />{pendingTasks.length} tarea(s)
                </p>
              )}
            </div>
            <div>
              <p className="text-[10px] uppercase text-slate-500 font-semibold mb-1.5 tracking-wide">Asignado</p>
              <Select value={data.assigned_name || '__none__'} onValueChange={v => set('assigned_name', v === '__none__' ? '' : v)}>
                <SelectTrigger className="h-8 text-xs bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sin asignar —</SelectItem>
                  {activeEmployees.map(e => (
                    <SelectItem key={e.id} value={e.full_name} className="text-xs">{e.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-[10px] uppercase text-slate-500 font-semibold mb-1.5 tracking-wide">Fecha</p>
              <Input
                type="date"
                value={data.scheduled_date || ''}
                onChange={e => set('scheduled_date', e.target.value)}
                className="h-8 text-xs bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>
        </div>

        {/* ── Tabs body ───────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <Tabs defaultValue="trabajo" className="h-full flex flex-col">
            <TabsList className="mx-4 mt-3 flex-shrink-0 grid grid-cols-6 h-8 bg-slate-800/60 border border-slate-700/50">
              <TabsTrigger value="trabajo" className="text-[10px] gap-1 data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">
                <CheckSquare className="h-3 w-3" />Trabajo
              </TabsTrigger>
              <TabsTrigger value="materiales" className="text-[10px] gap-1 data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">
                <Package className="h-3 w-3" />Mat.
              </TabsTrigger>
              <TabsTrigger value="horas" className="text-[10px] gap-1 data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">
                <Clock className="h-3 w-3" />Horas
              </TabsTrigger>
              <TabsTrigger value="media" className="text-[10px] gap-1 data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">
                <Camera className="h-3 w-3" />Media
              </TabsTrigger>
              <TabsTrigger value="costos" className="text-[10px] gap-1 data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">
                <DollarSign className="h-3 w-3" />Costos
              </TabsTrigger>
              <TabsTrigger value="incompleto" className="text-[10px] gap-1 data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">
                <ClipboardX className="h-3 w-3 text-red-400" /><span className="text-red-400">Inc.</span>
              </TabsTrigger>
            </TabsList>

            {/* ── TRABAJO ─────────────────────────────────────────────────── */}
            <TabsContent value="trabajo" className="flex-1 overflow-y-auto p-5 space-y-5 mt-0">

              {/* Descripción / Instrucciones */}
              {data.description && (
                <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    <p className="text-xs font-semibold uppercase text-slate-400 tracking-wide">Instrucciones</p>
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{data.description}</p>
                </div>
              )}

              {/* Checklist */}
              <WorkOrderChecklist checklist={data.checklist || []} onChange={val => saveField('checklist', val)} />

              {/* Horas */}
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-blue-400" />
                  <p className="text-xs font-semibold uppercase text-slate-400 tracking-wide">Tiempo</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Horas estimadas</p>
                    <Input
                      type="number"
                      value={data.estimated_hours || ''}
                      onChange={e => set('estimated_hours', parseFloat(e.target.value))}
                      className="bg-slate-800 border-slate-700 text-white text-sm h-9"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Horas reales</p>
                    <Input
                      type="number"
                      value={data.actual_hours || ''}
                      onChange={e => set('actual_hours', parseFloat(e.target.value))}
                      className="bg-slate-800 border-slate-700 text-white text-sm h-9"
                    />
                  </div>
                </div>
              </div>

              {/* GPS */}
              {data.gps_status && (
                <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Navigation className="h-4 w-4 text-emerald-400" />
                    <p className="text-xs font-semibold uppercase text-slate-400 tracking-wide">Ubicación GPS de campo</p>
                  </div>
                  {data.gps_status === 'capturado' ? (
                    <div className="space-y-1.5">
                      <p className="text-sm font-medium text-emerald-300">
                        {data.gps_latitude?.toFixed(6)}, {data.gps_longitude?.toFixed(6)}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-emerald-500">
                        {data.gps_accuracy && <span>Precisión: {data.gps_accuracy}m</span>}
                        {data.gps_timestamp && <span>{new Date(data.gps_timestamp).toLocaleString('es-AR')}</span>}
                      </div>
                      <a
                        href={`https://www.google.com/maps?q=${data.gps_latitude},${data.gps_longitude}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-xs text-primary underline flex items-center gap-1 mt-1"
                      >
                        <MapPin className="h-3 w-3" /> Ver en Google Maps
                      </a>
                    </div>
                  ) : (
                    <p className="text-sm text-amber-400 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      {data.gps_status === 'denegado' ? 'Permiso denegado' : 'No disponible'}
                    </p>
                  )}
                </div>
              )}

              {/* Notas */}
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400 tracking-wide mb-2">Notas</p>
                <textarea
                  className="w-full rounded-xl border border-slate-700/50 bg-slate-800/40 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 min-h-[70px] resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Notas del trabajo..."
                  value={data.notes || ''}
                  onChange={e => set('notes', e.target.value)}
                />
              </div>
            </TabsContent>

            {/* ── MATERIALES ──────────────────────────────────────────────── */}
            <TabsContent value="materiales" className="flex-1 overflow-y-auto p-5 mt-0">
              <WorkOrderMaterials
                materials={data.materials_used || []}
                faltantes={data.materiales_faltantes || []}
                onChangeMaterials={val => saveField('materials_used', val)}
                onChangeFaltantes={val => saveField('materiales_faltantes', val)}
              />
            </TabsContent>

            {/* ── HORAS ───────────────────────────────────────────────────── */}
            <TabsContent value="horas" className="flex-1 overflow-y-auto p-5 mt-0">
              <WorkOrderTimeLogs workOrderId={order.id} workOrderTitle={order.title} />
            </TabsContent>

            {/* ── MEDIA ───────────────────────────────────────────────────── */}
            <TabsContent value="media" className="flex-1 overflow-y-auto p-5 space-y-5 mt-0">
              {/* Fotos de referencia de creación */}
              {(data.photos || []).length === 0 && !data.signature_url && (
                <div className="text-center py-8 text-slate-500 text-sm">
                  <Camera className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No hay fotos todavía
                </div>
              )}
              <WorkOrderPhotos photos={data.photos || []} onChange={val => saveField('photos', val)} />
              <hr className="border-slate-700/50" />
              <WorkOrderSignature
                signatureUrl={data.signature_url}
                signatureName={data.signature_name}
                onChange={({ signatureUrl, signatureName }) => {
                  saveFields({ signature_url: signatureUrl, signature_name: signatureName });
                }}
              />
            </TabsContent>

            {/* ── COSTOS ──────────────────────────────────────────────────── */}
            <TabsContent value="costos" className="flex-1 overflow-y-auto p-5 mt-0">
              <WorkOrderCostSummary
                materials={data.materials_used || []}
                timeLogs={timeLogs}
                estimatedHours={data.estimated_hours}
                actualHours={data.actual_hours}
              />
            </TabsContent>

            {/* ── INCOMPLETO ──────────────────────────────────────────────── */}
            <TabsContent value="incompleto" className="flex-1 overflow-y-auto p-5 mt-0">
              <WorkOrderIncompleteReason
                motivos={data.motivos_incompleto || []}
                onChange={val => saveField('motivos_incompleto', val)}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="p-4 border-t border-slate-700/50 bg-slate-900/80 flex gap-2 flex-wrap justify-between">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              className="border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
              title="Exportar PDF"
              onClick={() => exportWorkOrderPDF(data, timeLogs)}
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
              title="Guardar como plantilla"
              onClick={handleSaveAsTemplate}
              disabled={savingTemplate}
            >
              {savingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
            </Button>
            <WorkOrderQRButton order={data} variant="outline" size="icon" onShowQR={() => setQrOpen(true)} className="border-slate-700 bg-slate-800 text-slate-300 hover:text-white" />
          </div>
          <div className="flex gap-2 flex-1 justify-end">
            {onDelete && <DeleteWorkOrderButton order={data} onDelete={onDelete} />}
            <Button
              variant="outline"
              className="border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
              onClick={onClose}
            >
              Cerrar
            </Button>
            <Button
              className="gap-2 bg-gradient-to-r from-purple-500 to-pink-600 hover:shadow-lg shadow-purple-500/30"
              onClick={save}
              disabled={saveMutation.isPending || (data.status === 'completada' && !canComplete)}
              title={checklistBlocked ? `${pendingTasks.length} tarea(s) pendiente(s)` : photosBlocked ? 'Falta foto' : ''}
            >
              {saveMutation.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</>
                : <><Save className="h-4 w-4" /> Guardar</>
              }
            </Button>
          </div>
        </div>
      </div>

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