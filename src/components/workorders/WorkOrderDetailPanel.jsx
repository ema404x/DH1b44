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
  ChevronDown, ChevronUp, Trash2
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
  baja:    { label: 'Baja',      color: 'bg-slate-600/40 text-slate-300 border-slate-500/60' },
  media:   { label: 'Media',     color: 'bg-blue-600/30 text-blue-300 border-blue-500/60' },
  alta:    { label: '! Alta',    color: 'bg-orange-600/30 text-orange-300 border-orange-500/60' },
  urgente: { label: '!! Urgente',color: 'bg-red-600/30 text-red-300 border-red-500/60' },
};

const STATUS_CONFIG = {
  pendiente:   { label: 'Pendiente',   color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50' },
  asignada:    { label: 'Asignada',    color: 'bg-blue-500/20 text-blue-300 border-blue-500/50' },
  en_progreso: { label: 'En Progreso', color: 'bg-purple-500/20 text-purple-300 border-purple-500/50' },
  en_espera:   { label: 'En Espera',   color: 'bg-slate-500/20 text-slate-300 border-slate-500/50' },
  completada:  { label: '✓ Completada',color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' },
  cancelada:   { label: 'Cancelada',   color: 'bg-red-500/20 text-red-300 border-red-500/50' },
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
  { key: 'trabajo',    label: 'Trabajo' },
  { key: 'materiales', label: 'Materiales' },
  { key: 'horas',      label: 'Horas' },
  { key: 'media',      label: 'Media' },
  { key: 'costos',     label: 'Costos' },
  { key: 'incompleto', label: 'Incompleto', accent: true },
];

export default function WorkOrderDetailPanel({ order, onClose, onDelete }) {
  const [data, setData] = useState({ ...order });
  const [activeTab, setActiveTab] = useState('trabajo');
  const [qrOpen, setQrOpen] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const queryClient = useQueryClient();

  // ── Fetch fresco desde el servidor ────────────────────────────────────────
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

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('full_name', 200),
    staleTime: 1000 * 60 * 10,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => { if (!saveMutation.isPending) onClose(); }}
      />

      {/* Modal card */}
      <div className="relative w-full max-w-xl bg-[#0f1117] rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh] border border-slate-700/40">

        {/* ── HEADER con gradiente ─────────────────────────────────────── */}
        <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-500 px-5 pt-5 pb-4 flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          {loadingFresh && (
            <button onClick={() => refetch()} className="absolute top-4 right-11 text-white/50 hover:text-white/80">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            </button>
          )}

          <div className="flex items-center gap-3 pr-8">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-white leading-tight truncate">{data.title}</h2>
              {data.code && <p className="text-xs text-white/60 mt-0.5">ID: {data.code}</p>}
            </div>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className={`text-xs px-3 py-1 rounded-full border font-medium ${priorityCfg.color}`}>
              {priorityCfg.label}
            </span>
            <span className="text-xs px-3 py-1 rounded-full border border-white/20 bg-white/10 text-white/80">
              Tipo: {TYPE_LABELS[data.type] || data.type}
            </span>
            <span className={`text-xs px-3 py-1 rounded-full border font-medium ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
          </div>
        </div>

        {/* ── TABS ────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 px-4 pt-3 pb-2 flex-shrink-0 overflow-x-auto scrollbar-none">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`text-xs px-3.5 py-1.5 rounded-full font-medium whitespace-nowrap transition-all border
                ${activeTab === tab.key
                  ? tab.accent
                    ? 'bg-orange-500/20 border-orange-500/60 text-orange-300'
                    : 'bg-indigo-600/30 border-indigo-500/60 text-indigo-200'
                  : 'border-slate-700/50 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── META CHIPS ───────────────────────────────────────────────────── */}
        <div className="px-4 pb-3 flex flex-wrap gap-2 flex-shrink-0">
          {data.location && (
            <span className="flex items-center gap-1.5 text-xs bg-slate-800/60 border border-slate-700/50 rounded-full px-3 py-1 text-slate-300">
              <MapPin className="h-3 w-3 text-slate-400" /> {data.location}
            </span>
          )}
          {data.assigned_name && (
            <span className="flex items-center gap-1.5 text-xs bg-slate-800/60 border border-slate-700/50 rounded-full px-3 py-1 text-slate-300">
              <User className="h-3 w-3 text-slate-400" /> {data.assigned_name}
            </span>
          )}
          {data.scheduled_date && (
            <span className="flex items-center gap-1.5 text-xs bg-slate-800/60 border border-slate-700/50 rounded-full px-3 py-1 text-slate-300">
              <Calendar className="h-3 w-3 text-slate-400" /> {data.scheduled_date}
            </span>
          )}
        </div>

        {/* ── QUICK STATUS / ASSIGN ────────────────────────────────────────── */}
        <div className="px-4 pb-3 grid grid-cols-3 gap-2 flex-shrink-0">
          <div>
            <p className="text-[10px] uppercase text-slate-500 font-semibold mb-1 tracking-wide">Estado</p>
            <Select value={data.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="h-8 text-xs bg-slate-800/80 border-slate-700 text-white">
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
          </div>
          <div>
            <p className="text-[10px] uppercase text-slate-500 font-semibold mb-1 tracking-wide">Asignado</p>
            <Select value={data.assigned_name || '__none__'} onValueChange={v => set('assigned_name', v === '__none__' ? '' : v)}>
              <SelectTrigger className="h-8 text-xs bg-slate-800/80 border-slate-700 text-white">
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
            <Input
              type="date"
              value={data.scheduled_date || ''}
              onChange={e => set('scheduled_date', e.target.value)}
              className="h-8 text-xs bg-slate-800/80 border-slate-700 text-white"
            />
          </div>
        </div>

        {/* ── TAB CONTENT ─────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-3">

          {/* TRABAJO */}
          {activeTab === 'trabajo' && (
            <>
              {data.description && (
                <div className="bg-white rounded-xl p-4">
                  <p className="text-sm font-semibold text-slate-800 mb-1.5">Instrucciones</p>
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{data.description}</p>
                </div>
              )}

              <div className="bg-white rounded-xl p-4">
                <p className="text-sm font-semibold text-slate-800 mb-2">Checklist</p>
                <WorkOrderChecklist checklist={data.checklist || []} onChange={val => saveField('checklist', val)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-xl p-4">
                  <p className="text-sm font-semibold text-slate-800 mb-2">Horas estimadas/reales</p>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="0 h"
                      value={data.estimated_hours || ''}
                      onChange={e => set('estimated_hours', parseFloat(e.target.value))}
                      className="text-sm bg-slate-50 border-slate-200 text-slate-800 h-9"
                    />
                    <Input
                      type="number"
                      placeholder="Reales"
                      value={data.actual_hours || ''}
                      onChange={e => set('actual_hours', parseFloat(e.target.value))}
                      className="text-sm bg-slate-50 border-slate-200 text-slate-800 h-9"
                    />
                  </div>
                </div>

                <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/40">
                  <p className="text-sm font-semibold text-slate-200 mb-2">Notas</p>
                  <textarea
                    className="w-full bg-transparent text-sm text-slate-400 placeholder:text-slate-500 resize-none focus:outline-none min-h-[48px]"
                    placeholder="No resita contrado"
                    value={data.notes || ''}
                    onChange={e => set('notes', e.target.value)}
                  />
                </div>
              </div>

              {data.gps_status && (
                <div className="bg-white rounded-xl p-4">
                  <p className="text-sm font-semibold text-slate-800 mb-2">GPS</p>
                  {data.gps_status === 'capturado' ? (
                    <div className="space-y-1">
                      <p className="text-sm text-slate-700 flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-slate-400" />
                        {data.gps_latitude?.toFixed(6)}, {data.gps_longitude?.toFixed(6)}
                      </p>
                      <a
                        href={`https://www.google.com/maps?q=${data.gps_latitude},${data.gps_longitude}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-xs text-indigo-600 underline"
                      >
                        Ver en Google Maps
                      </a>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                      {data.gps_status === 'denegado' ? 'Permiso denegado' : 'No disponible'}
                    </p>
                  )}
                </div>
              )}

              <div className="bg-white rounded-xl p-4">
                <p className="text-sm font-semibold text-slate-800 mb-2">Notas</p>
                <textarea
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400 min-h-[80px]"
                  placeholder="Notas en secuentnado"
                  value={data.notes || ''}
                  onChange={e => set('notes', e.target.value)}
                />
              </div>
            </>
          )}

          {/* MATERIALES */}
          {activeTab === 'materiales' && (
            <div className="bg-white rounded-xl p-4">
              <WorkOrderMaterials
                materials={data.materials_used || []}
                faltantes={data.materiales_faltantes || []}
                onChangeMaterials={val => saveField('materials_used', val)}
                onChangeFaltantes={val => saveField('materiales_faltantes', val)}
              />
            </div>
          )}

          {/* HORAS */}
          {activeTab === 'horas' && (
            <div className="bg-white rounded-xl p-4">
              <WorkOrderTimeLogs workOrderId={order.id} workOrderTitle={order.title} />
            </div>
          )}

          {/* MEDIA */}
          {activeTab === 'media' && (
            <div className="space-y-3">
              <div className="bg-white rounded-xl p-4">
                <WorkOrderPhotos photos={data.photos || []} onChange={val => saveField('photos', val)} />
              </div>
              <div className="bg-white rounded-xl p-4">
                <WorkOrderSignature
                  signatureUrl={data.signature_url}
                  signatureName={data.signature_name}
                  onChange={({ signatureUrl, signatureName }) => {
                    saveFields({ signature_url: signatureUrl, signature_name: signatureName });
                  }}
                />
              </div>
            </div>
          )}

          {/* COSTOS */}
          {activeTab === 'costos' && (
            <div className="bg-white rounded-xl p-4">
              <WorkOrderCostSummary
                materials={data.materials_used || []}
                timeLogs={timeLogs}
                estimatedHours={data.estimated_hours}
                actualHours={data.actual_hours}
              />
            </div>
          )}

          {/* INCOMPLETO */}
          {activeTab === 'incompleto' && (
            <div className="bg-white rounded-xl p-4">
              <WorkOrderIncompleteReason
                motivos={data.motivos_incompleto || []}
                onChange={val => saveField('motivos_incompleto', val)}
              />
            </div>
          )}
        </div>

        {/* ── FOOTER ──────────────────────────────────────────────────────── */}
        <div className="px-4 py-3 border-t border-slate-700/50 bg-[#0f1117] flex items-center gap-2 flex-shrink-0">
          {/* Left actions */}
          <button
            onClick={() => exportWorkOrderPDF(data, timeLogs)}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg px-3 py-2 transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> PDF
          </button>
          <button
            onClick={handleSaveAsTemplate}
            disabled={savingTemplate}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
          >
            {savingTemplate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />} Plantilla
          </button>
          <button
            onClick={() => setQrOpen(true)}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg px-3 py-2 transition-colors"
          >
            <QrCode className="h-3.5 w-3.5" /> QR
          </button>

          <div className="flex-1" />

          {/* Right actions */}
          {onDelete && (
            <DeleteWorkOrderButton order={data} onDelete={onDelete} />
          )}
          <button
            onClick={onClose}
            className="text-xs text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg px-4 py-2 transition-colors"
          >
            Cerrar
          </button>
          <button
            onClick={save}
            disabled={saveMutation.isPending || (data.status === 'completada' && !canComplete)}
            className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
          >
            {saveMutation.isPending
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardando</>
              : <><Save className="h-3.5 w-3.5" /> Guardar</>
            }
          </button>
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