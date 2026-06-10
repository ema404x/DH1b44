import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  X, Save, Loader2, MapPin, CheckSquare, Camera,
  Package, Clock, DollarSign, Download, AlertTriangle, Navigation,
  Layers, ClipboardX, User, RefreshCw, QrCode, FileText, Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import DeleteWorkOrderButton from './DeleteWorkOrderButton';
import WorkOrderChecklist from './WorkOrderChecklist';
import WorkOrderPhotos from './WorkOrderPhotos';
import WorkOrderSignature from './WorkOrderSignature';
import WorkOrderMaterials from './WorkOrderMaterials';
import WorkOrderTimeLogs from './WorkOrderTimeLogs';
import WorkOrderCostSummary from './WorkOrderCostSummary';
import WorkOrderIncompleteReason from './WorkOrderIncompleteReason';
import QRCodeModal from '@/components/shared/QRCodeModal';
import { exportWorkOrderPDF } from '@/utils/exportWorkOrderPDF';

// ── Config ─────────────────────────────────────────────────────────────────

const PRIORITY_CFG = {
  baja:    { label: 'Baja',       cls: 'bg-slate-700/60 text-slate-300 border-slate-600' },
  media:   { label: 'Media',      cls: 'bg-blue-900/60 text-blue-300 border-blue-700' },
  alta:    { label: '⚠ Alta',     cls: 'bg-orange-900/60 text-orange-300 border-orange-700' },
  urgente: { label: '🚨 Urgente', cls: 'bg-red-900/60 text-red-300 border-red-700' },
};

const STATUS_CFG = {
  pendiente:   { label: 'Pendiente',    cls: 'bg-yellow-900/50 text-yellow-300 border-yellow-700' },
  asignada:    { label: 'Asignada',     cls: 'bg-blue-900/50 text-blue-300 border-blue-700' },
  en_progreso: { label: 'En Progreso',  cls: 'bg-violet-900/50 text-violet-300 border-violet-700' },
  en_espera:   { label: 'En Espera',    cls: 'bg-slate-700/50 text-slate-300 border-slate-600' },
  completada:  { label: '✓ Completada', cls: 'bg-emerald-900/50 text-emerald-300 border-emerald-700' },
  cancelada:   { label: 'Cancelada',    cls: 'bg-red-900/50 text-red-300 border-red-700' },
};

const TYPE_LABELS = {
  mantenimiento_preventivo: 'Preventivo',
  mantenimiento_correctivo: 'Correctivo',
  instalacion: 'Instalación',
  inspeccion: 'Inspección',
  reparacion: 'Reparación',
  emergencia: 'Emergencia',
};

const TABS = [
  { key: 'trabajo',    label: 'Trabajo',    icon: CheckSquare },
  { key: 'materiales', label: 'Materiales', icon: Package },
  { key: 'horas',      label: 'Horas',      icon: Clock },
  { key: 'media',      label: 'Media',      icon: Camera },
  { key: 'costos',     label: 'Costos',     icon: DollarSign },
  { key: 'incompleto', label: 'Incompleto', icon: ClipboardX, accent: true },
];

// ── Card section wrapper ────────────────────────────────────────────────────
function Section({ title, children, className = '' }) {
  return (
    <div className={`bg-slate-800/50 border border-slate-700/60 rounded-xl p-4 ${className}`}>
      {title && <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">{title}</p>}
      {children}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function WorkOrderDetailPanel({ order, onClose, onDelete }) {
  const [data, setData] = useState({ ...order });
  const [activeTab, setActiveTab] = useState('trabajo');
  const [qrOpen, setQrOpen] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const queryClient = useQueryClient();

  // Fresh fetch on open
  const { data: freshOrder, isLoading: loadingFresh, refetch } = useQuery({
    queryKey: ['workorder-detail', order.id],
    queryFn: async () => {
      const r = await base44.entities.WorkOrder.filter({ id: order.id });
      return r[0] || order;
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });
  useEffect(() => { if (freshOrder) setData({ ...freshOrder }); }, [freshOrder]);

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('full_name', 200),
    staleTime: 600_000,
  });
  const activeEmployees = employees.filter(e => e.status === 'activo' || !e.status);

  const { data: timeLogs = [] } = useQuery({
    queryKey: ['timelogs', order.id],
    queryFn: () => base44.entities.TimeLog.filter({ work_order_id: order.id }),
    enabled: !!order.id,
  });

  const saveMutation = useMutation({
    mutationFn: (d) => base44.entities.WorkOrder.update(order.id, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workorders'] });
      queryClient.invalidateQueries({ queryKey: ['workorder-detail', order.id] });
      toast.success('Orden guardada');
    },
  });

  const set = useCallback((k, v) => setData(p => ({ ...p, [k]: v })), []);
  const saveTimerRef = useRef(null);
  const latestRef = useRef(data);
  useEffect(() => { latestRef.current = data; }, [data]);
  useEffect(() => () => clearTimeout(saveTimerRef.current), []);

  const saveField = useCallback((k, v) => {
    setData(p => {
      const next = { ...p, [k]: v };
      latestRef.current = next;
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => saveMutation.mutate(next), 300);
      return next;
    });
  }, [saveMutation]);

  const saveFields = useCallback((fields) => {
    setData(p => {
      const next = { ...p, ...fields };
      latestRef.current = next;
      clearTimeout(saveTimerRef.current);
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
    } finally { setSavingTemplate(false); }
  };

  const checklist = data.checklist || [];
  const pendingTasks = checklist.filter(t => !t.completed);
  const checklistBlocked = checklist.length > 0 && pendingTasks.length > 0;
  const photosBlocked = data.require_photos && (data.photos || []).length === 0;
  const canComplete = !checklistBlocked && !photosBlocked;

  const save = () => {
    if (checklistBlocked) { toast.warning(`Faltan ${pendingTasks.length} tarea(s)`); return; }
    if (photosBlocked) { toast.warning('Falta foto obligatoria'); return; }
    saveMutation.mutate(data);
  };

  const pCfg = PRIORITY_CFG[data.priority] || PRIORITY_CFG.media;
  const sCfg = STATUS_CFG[data.status] || STATUS_CFG.pendiente;

  return (
    <>
      {/* ── Overlay ──────────────────────────────────────────────────────── */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={() => { if (!saveMutation.isPending) onClose(); }}
        />

        {/* ── Modal ──────────────────────────────────────────────────────── */}
        {/* Mobile: sheet desde abajo (rounded-t-2xl). Desktop: card centrada */}
        <div className="relative z-10 w-full sm:max-w-xl sm:mx-4 bg-[#10131c] sm:rounded-2xl rounded-t-2xl shadow-2xl border border-slate-700/50 flex flex-col overflow-hidden"
          style={{ maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - 8px)', height: '94dvh' }}
        >

          {/* ── HEADER ─────────────────────────────────────────────────── */}
          <div className="flex-shrink-0 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #2563eb 100%)' }}
          >
            {/* Decorative circles */}
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5" />
            <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-white/5" />

            <div className="relative px-5 pt-5 pb-4">
              {/* Top row: icon + title + close */}
              <div className="flex items-start gap-3 pr-10">
                <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/50 font-mono mb-0.5 truncate">{data.code || `OT-${order.id?.slice(-6)}`}</p>
                  <h2 className="text-base sm:text-lg font-bold text-white leading-snug">{data.title}</h2>
                </div>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${pCfg.cls}`}>{pCfg.label}</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full border border-white/20 bg-white/10 text-white/80">
                  {TYPE_LABELS[data.type] || data.type}
                </span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${sCfg.cls}`}>{sCfg.label}</span>
              </div>

              {/* Meta chips */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {data.location && (
                  <span className="flex items-center gap-1 text-xs text-white/70 bg-white/10 rounded-full px-2.5 py-0.5">
                    <MapPin className="h-3 w-3" />{data.location}
                  </span>
                )}
                {data.assigned_name && (
                  <span className="flex items-center gap-1 text-xs text-white/70 bg-white/10 rounded-full px-2.5 py-0.5">
                    <User className="h-3 w-3" />{data.assigned_name}
                  </span>
                )}
                {data.scheduled_date && (
                  <span className="flex items-center gap-1 text-xs text-white/70 bg-white/10 rounded-full px-2.5 py-0.5">
                    <Calendar className="h-3 w-3" />{data.scheduled_date}
                  </span>
                )}
              </div>
            </div>

            {/* Close + refresh */}
            <button onClick={onClose} className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors p-1">
              <X className="h-5 w-5" />
            </button>
            {loadingFresh && (
              <button onClick={() => refetch()} className="absolute top-4 right-11 text-white/40 hover:text-white/70 p-1">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              </button>
            )}
          </div>

          {/* ── QUICK FIELDS ───────────────────────────────────────────── */}
          <div className="flex-shrink-0 px-4 py-3 border-b border-slate-700/50 bg-slate-900/60 grid grid-cols-3 gap-2">
            <div>
              <p className="text-[10px] uppercase text-slate-500 font-semibold mb-1 tracking-wide">Estado</p>
              <Select value={data.status} onValueChange={v => { if (v === 'completada' && !canComplete) return; set('status', v); }}>
                <SelectTrigger className="h-8 text-xs bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CFG).map(([val, cfg]) => (
                    <SelectItem key={val} value={val} disabled={val === 'completada' && checklistBlocked} className="text-xs">
                      {cfg.label}{val === 'completada' && checklistBlocked ? ' 🔒' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {checklistBlocked && <p className="text-[9px] text-orange-400 mt-0.5 flex items-center gap-0.5"><AlertTriangle className="h-2.5 w-2.5" />{pendingTasks.length} pendiente(s)</p>}
            </div>
            <div>
              <p className="text-[10px] uppercase text-slate-500 font-semibold mb-1 tracking-wide">Asignado</p>
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
              <p className="text-[10px] uppercase text-slate-500 font-semibold mb-1 tracking-wide">Fecha</p>
              <Input type="date" value={data.scheduled_date || ''} onChange={e => set('scheduled_date', e.target.value)}
                className="h-8 text-xs bg-slate-800 border-slate-700 text-white" />
            </div>
          </div>

          {/* ── TABS ───────────────────────────────────────────────────── */}
          <div className="flex-shrink-0 px-4 pt-3 pb-2 overflow-x-auto scrollbar-none">
            <div className="flex gap-1 min-w-max">
              {TABS.map(({ key, label, icon: Icon, accent }) => {
                const active = activeTab === key;
                return (
                  <button key={key} onClick={() => setActiveTab(key)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-all border
                      ${active
                        ? accent
                          ? 'bg-orange-500/20 border-orange-500/60 text-orange-300'
                          : 'bg-indigo-600/30 border-indigo-500/50 text-indigo-200'
                        : 'border-slate-700/60 text-slate-500 hover:text-slate-300 hover:border-slate-600'
                      }`}
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── CONTENT ────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-3">

            {/* TRABAJO */}
            {activeTab === 'trabajo' && (
              <>
                {data.description && (
                  <Section title="Instrucciones">
                    <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{data.description}</p>
                  </Section>
                )}

                <Section title="Checklist">
                  <WorkOrderChecklist checklist={data.checklist || []} onChange={val => saveField('checklist', val)} />
                </Section>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Section title="Horas">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] text-slate-500 mb-1">Estimadas</p>
                        <Input type="number" placeholder="0" value={data.estimated_hours || ''}
                          onChange={e => set('estimated_hours', parseFloat(e.target.value))}
                          className="h-9 text-sm bg-slate-800 border-slate-700 text-white" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 mb-1">Reales</p>
                        <Input type="number" placeholder="0" value={data.actual_hours || ''}
                          onChange={e => set('actual_hours', parseFloat(e.target.value))}
                          className="h-9 text-sm bg-slate-800 border-slate-700 text-white" />
                      </div>
                    </div>
                  </Section>

                  {data.gps_status && (
                    <Section title="GPS">
                      {data.gps_status === 'capturado' ? (
                        <div className="space-y-1">
                          <p className="text-sm text-emerald-300 flex items-center gap-1.5">
                            <Navigation className="h-3.5 w-3.5" />
                            {data.gps_latitude?.toFixed(5)}, {data.gps_longitude?.toFixed(5)}
                          </p>
                          <a href={`https://www.google.com/maps?q=${data.gps_latitude},${data.gps_longitude}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-xs text-indigo-400 underline">
                            Ver en Maps
                          </a>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500 flex items-center gap-1.5">
                          <AlertTriangle className="h-4 w-4 text-amber-400" />
                          {data.gps_status === 'denegado' ? 'Permiso denegado' : 'No disponible'}
                        </p>
                      )}
                    </Section>
                  )}
                </div>

                <Section title="Notas">
                  <textarea
                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[80px]"
                    placeholder="Agregar notas..."
                    value={data.notes || ''}
                    onChange={e => set('notes', e.target.value)}
                  />
                </Section>
              </>
            )}

            {activeTab === 'materiales' && (
              <Section>
                <WorkOrderMaterials
                  materials={data.materials_used || []}
                  faltantes={data.materiales_faltantes || []}
                  onChangeMaterials={val => saveField('materials_used', val)}
                  onChangeFaltantes={val => saveField('materiales_faltantes', val)}
                />
              </Section>
            )}

            {activeTab === 'horas' && (
              <Section>
                <WorkOrderTimeLogs workOrderId={order.id} workOrderTitle={order.title} />
              </Section>
            )}

            {activeTab === 'media' && (
              <>
                <Section title="Fotos">
                  <WorkOrderPhotos photos={data.photos || []} onChange={val => saveField('photos', val)} />
                </Section>
                <Section title="Firma">
                  <WorkOrderSignature
                    signatureUrl={data.signature_url}
                    signatureName={data.signature_name}
                    onChange={({ signatureUrl, signatureName }) =>
                      saveFields({ signature_url: signatureUrl, signature_name: signatureName })}
                  />
                </Section>
              </>
            )}

            {activeTab === 'costos' && (
              <Section>
                <WorkOrderCostSummary
                  materials={data.materials_used || []}
                  timeLogs={timeLogs}
                  estimatedHours={data.estimated_hours}
                  actualHours={data.actual_hours}
                />
              </Section>
            )}

            {activeTab === 'incompleto' && (
              <Section>
                <WorkOrderIncompleteReason
                  motivos={data.motivos_incompleto || []}
                  onChange={val => saveField('motivos_incompleto', val)}
                />
              </Section>
            )}
          </div>

          {/* ── FOOTER ─────────────────────────────────────────────────── */}
          <div className="flex-shrink-0 px-4 py-3 border-t border-slate-700/50 bg-slate-900/80">
            {/* Mobile: 2 rows. Desktop: 1 row */}
            <div className="flex items-center justify-between gap-2">
              {/* Tool buttons */}
              <div className="flex items-center gap-1.5">
                <button onClick={() => exportWorkOrderPDF(data, timeLogs)}
                  title="Exportar PDF"
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg px-2.5 py-1.5 transition-colors">
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">PDF</span>
                </button>
                <button onClick={handleSaveAsTemplate} disabled={savingTemplate} title="Guardar como plantilla"
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-40">
                  {savingTemplate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">Plantilla</span>
                </button>
                <button onClick={() => setQrOpen(true)} title="Código QR"
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg px-2.5 py-1.5 transition-colors">
                  <QrCode className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">QR</span>
                </button>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                {onDelete && <DeleteWorkOrderButton order={data} onDelete={onDelete} />}
                <button onClick={onClose}
                  className="text-xs text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg px-3 sm:px-4 py-2 transition-colors">
                  Cerrar
                </button>
                <button onClick={save}
                  disabled={saveMutation.isPending || (data.status === 'completada' && !canComplete)}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-3 sm:px-4 py-2 transition-colors disabled:opacity-50 shadow-lg shadow-indigo-900/40">
                  {saveMutation.isPending
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /><span className="hidden sm:inline">Guardando...</span></>
                    : <><Save className="h-3.5 w-3.5" /><span>Guardar</span></>}
                </button>
              </div>
            </div>
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
    </>
  );
}