import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  X, Save, Loader2, MapPin, CheckSquare, Camera, Package,
  Download, AlertTriangle, Navigation, Layers, ClipboardX,
  User, RefreshCw, QrCode, FileText, Calendar, ChevronDown,
  CheckCircle2, Circle, Zap, Wrench, Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import DeleteWorkOrderButton from './DeleteWorkOrderButton';
import WorkOrderChecklist from './WorkOrderChecklist';
import WorkOrderPhotos from './WorkOrderPhotos';
import WorkOrderSignature from './WorkOrderSignature';
import WorkOrderMaterials from './WorkOrderMaterials';
import WorkOrderIncompleteReason from './WorkOrderIncompleteReason';
import QRCodeModal from '@/components/shared/QRCodeModal';
import { exportWorkOrderPDF } from '@/utils/exportWorkOrderPDF';
import LocationEditor from './LocationEditor';
import ReporteOperarioResumen from './ReporteOperarioResumen';
import RechazoOTModal from './RechazoOTModal';
import { getAvailableActions, getTransitionAction, ACTION_VARIANTS } from '@/lib/workorder-transitions';
import { useResolveCreator } from '@/hooks/useResolveCreator';
import { useCurrentUser } from '@/hooks/useCurrentUser';

// ── Config ──────────────────────────────────────────────────────────────────

const PRIORITY_CFG = {
  baja:    { label: 'Baja',       dot: 'bg-slate-400',  pill: 'bg-slate-700/60 text-slate-300 border-slate-600' },
  media:   { label: 'Media',      dot: 'bg-blue-400',   pill: 'bg-blue-900/50 text-blue-300 border-blue-700' },
  alta:    { label: 'Alta',       dot: 'bg-orange-400', pill: 'bg-orange-900/50 text-orange-300 border-orange-700' },
  urgente: { label: 'Urgente',    dot: 'bg-red-500 animate-pulse', pill: 'bg-red-900/50 text-red-300 border-red-700' },
};

const STATUS_CFG = {
  pendiente:   { label: 'Pendiente',    color: 'text-yellow-300', bg: 'bg-yellow-900/30 border-yellow-700/50' },
  asignada:    { label: 'Asignada',     color: 'text-blue-300',   bg: 'bg-blue-900/30 border-blue-700/50' },
  en_progreso: { label: 'En Progreso',  color: 'text-violet-300', bg: 'bg-violet-900/30 border-violet-700/50' },
  obra:        { label: 'Obra',         color: 'text-pink-300',   bg: 'bg-pink-900/30 border-pink-700/50' },
  pendiente_validacion: { label: 'Validación', color: 'text-amber-300', bg: 'bg-amber-900/30 border-amber-700/50' },
  completada:  { label: 'Completada',   color: 'text-emerald-300',bg: 'bg-emerald-900/30 border-emerald-700/50' },
  cancelada:   { label: 'Cancelada',    color: 'text-red-300',    bg: 'bg-red-900/30 border-red-700/50' },
};

const TYPE_LABELS = {
  mantenimiento_preventivo: 'Preventivo',
  mantenimiento_correctivo: 'Correctivo',
  instalacion: 'Instalación',
  inspeccion: 'Inspección',
  reparacion: 'Reparación',
  emergencia: 'Emergencia',
};

// ── Collapsible section ──────────────────────────────────────────────────────
function CollapseSection({ icon: Icon, title, badge, defaultOpen = true, accent, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${accent ? 'border-orange-700/40' : 'border-slate-700/50'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${
          accent ? 'bg-orange-900/20 hover:bg-orange-900/30' : 'bg-slate-800/60 hover:bg-slate-800/90'
        }`}
      >
        <div className="flex items-center gap-2">
          <Icon className={`h-3.5 w-3.5 ${accent ? 'text-orange-400' : 'text-slate-400'}`} />
          <span className={`text-xs font-semibold uppercase tracking-wider ${accent ? 'text-orange-300' : 'text-slate-300'}`}>{title}</span>
          {badge != null && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${accent ? 'bg-orange-500/20 text-orange-300' : 'bg-indigo-500/20 text-indigo-300'}`}>
              {badge}
            </span>
          )}
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="bg-slate-900/40 px-4 py-3">{children}</div>}
    </div>
  );
}

// ── Progress ring (mini) ─────────────────────────────────────────────────────
function MiniRing({ value, total, color = '#6366f1' }) {
  if (!total) return null;
  const pct = Math.round((value / total) * 100);
  const r = 14, circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width="36" height="36" className="-rotate-90">
      <circle cx="18" cy="18" r={r} fill="none" stroke="#1e293b" strokeWidth="3" />
      <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.5s ease' }}
      />
      <text x="18" y="18" textAnchor="middle" dominantBaseline="central"
        className="rotate-90 fill-white text-[9px] font-bold"
        transform="rotate(90, 18, 18)" style={{ fontSize: 9 }}>
        {pct}%
      </text>
    </svg>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function WorkOrderDetailPanel({ order, onClose, onDelete }) {
  const [data, setData] = useState({ ...order });
  const [qrOpen, setQrOpen] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [convertingToObra, setConvertingToObra] = useState(false);
  const [rechazoOpen, setRechazoOpen] = useState(false);
  const queryClient = useQueryClient();
  const { resolveOTOwner } = useResolveCreator();
  const { name: creadorPor, label: creadorLabel } = resolveOTOwner(order);
  const { isSuperAdmin } = useCurrentUser();

  const { data: freshOrder, isLoading: loadingFresh, refetch } = useQuery({
    queryKey: ['workorder-detail', order.id],
    queryFn: async () => {
      const r = await base44.entities.WorkOrder.filter({ id: order.id });
      return r[0] || order;
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });
  // dirtyRef rastrea qué campos fueron modificados localmente y aún no persistieron.
  // Al sincronizar con freshOrder (refetch), solo sobrescribimos si NO hay edits pendientes —
  // si los hay, esperamos al flush + invalidación para sincronizar sin perder datos.
  useEffect(() => { if (freshOrder && dirtyRef.current.size === 0) { setData({ ...freshOrder }); } }, [freshOrder]);

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('full_name', 200),
    staleTime: 600_000,
  });
  // Operarios del sector vía backend (getOperariosSector): service-role, sector-scoped,
  // read-only. Reemplaza los lookups client-side (Employee.list / User.list) que la RLS
  // dejaba vacíos para un jefe_sitio → nunca podía resolver el user_id de otro operario
  // → assigned_to quedaba vacío. Ahora el jefe resuelve operarios con cuenta y estampa
  // assigned_to (visibilidad por FK, no solo por match de nombre en getWorkOrdersForUser).
  const { data: operariosSector = [] } = useQuery({
    queryKey: ['operarios-sector', data.sector_id],
    queryFn: async () => {
      const res = await base44.functions.invoke('getOperariosSector');
      return res.data?.operarios || [];
    },
    staleTime: 600_000,
    retry: false,
  });
  // Los jefes de sitio no pueden asignar OTs a otros jefes de sitio — solo a operarios.
  // Los gerentes/admins sí pueden asignar a cualquier empleado, incluyendo jefes.
  const isJefeRole = (role) => role && role.toLowerCase().replace(/[\s_]+/g, '').includes('jefe');
  const activeEmployees = employees
    .filter(e => (e.status === 'activo' || !e.status))
    .filter(e => isSuperAdmin || !isJefeRole(e.role));
  const assignableOperarios = operariosSector
    .filter(o => (o.status === 'activo' || !o.status))
    .filter(o => isSuperAdmin || !o.is_jefe);

  // Resuelve nombre tipeado → { user_id, email, isJefe, full_name }. operariosSector es
  // la lista completa del sector (fichas con/sin cuenta + users sin ficha), así un
  // jefe_sitio ahora resuelve cualquier operario. activeEmployees queda como fallback
  // por si operariosSector aún no cargó (cache de employees ya poblado para admins).
  const normalizeName = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ');
  const resolveEmployeeByName = (name) => {
    const target = normalizeName(name);
    if (!target) return null;
    const match = assignableOperarios.find(o => normalizeName(o.full_name) === target);
    if (match) return { user_id: match.user_id, email: match.email, isJefe: !!match.is_jefe, full_name: match.full_name };
    const emp = activeEmployees.find(e => normalizeName(e.full_name) === target);
    if (emp) return { user_id: emp.user_id, email: emp.email, isJefe: isJefeRole(emp.role), full_name: emp.full_name };
    return null;
  };

  const handleAssignedNameChange = (e) => {
    const name = e.target.value;
    const match = resolveEmployeeByName(name);
    const fields = { assigned_name: name };
    if (match && match.user_id) {
      fields.assigned_to = match.user_id;
      // Si el asignado es jefe de sitio, estampar jefe_sitio_email para visibilidad RLS
      if (match.isJefe && match.email) {
        fields.jefe_sitio_email = match.email.toLowerCase().trim();
      }
    } else {
      fields.assigned_to = '';
    }
    saveFields(fields);
  };

  const handleAssignedNameBlur = () => {
    const name = (data.assigned_name || '').trim();
    if (!name) return;
    const match = resolveEmployeeByName(name);
    if (!match) {
      toast.warning(`No se encontró a "${name}" en el equipo. El operario no verá esta OT hasta tener usuario vinculado.`);
    } else if (!match.user_id) {
      toast.warning(`${match.full_name} no tiene usuario vinculado. No verá esta OT en Mis Órdenes hasta tenerlo.`);
    }
  };

  const closeAfterSaveRef = useRef(false);
  // OTs del sector escuela → rutea por el backend actualizarOT (service-role +
  // guard de sector explícito) para bybassear el gap de RLS que bloquea a un jefe
  // de actualizar OTs asignadas a él por nombre (sin jefe_sitio_email/created_by
  // que lo respalde). OTs de otros sectores → SDK directo (RLS), sin cambios.
  const isEscuelaOT = order.sector_id === 'escuela';
  const saveMutation = useMutation({
    mutationFn: (d) => isEscuelaOT
      ? base44.functions.invoke('actualizarOT', { ot_id: order.id, patch: d }).then(r => r.data?.ot)
      : base44.entities.WorkOrder.update(order.id, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workorders'] });
      queryClient.invalidateQueries({ queryKey: ['workorder-detail', order.id] });
      toast.success('Guardado');
      if (closeAfterSaveRef.current) {
        closeAfterSaveRef.current = false;
        onClose();
      }
    },
    onError: (err) => {
      // Siempre visible (también en auto-save) — cierra el cabo suelto del
      // guardado silencioso: antes un 403 en auto-save no daba feedback, el edit
      // quedaba en pantalla sin persistir y se revertía al reabrir.
      const msg = err?.response?.data?.error || err?.message || 'Error al guardar';
      toast.error(msg);
      if (closeAfterSaveRef.current) closeAfterSaveRef.current = false;
    },
  });

  const saveTimerRef = useRef(null);
  const latestRef = useRef(data);
  const mountedRef = useRef(true);
  // dirtyRef: set de nombres de campo modificados localmente que aún no se persistieron.
  // El save debounced envía SOLO estos campos (no el objeto completo) — evita
  // sobrescribir cambios concurrentes de la máquina de estados u otros usuarios.
  const dirtyRef = useRef(new Set());
  useEffect(() => { latestRef.current = data; }, [data]);

  // saveMutationRef evita closures stale en los debounced callbacks
  const saveMutationRef = useRef(saveMutation);
  useEffect(() => { saveMutationRef.current = saveMutation; }, [saveMutation]);

  // flushDirty: envía solo los campos marcados como sucios y limpia el set.
  // Es la única función que dispara el update — garantiza que nunca se envía
  // el objeto completo con campos stale o de solo lectura.
  const flushDirty = useCallback(() => {
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    if (dirtyRef.current.size === 0) return;
    const patch = {};
    dirtyRef.current.forEach(k => { patch[k] = latestRef.current[k]; });
    dirtyRef.current.clear();
    saveMutationRef.current.mutate(patch);
  }, []);

  // Cleanup: al desmontar, si hay campos sucios pendientes, flushearlos
  // inmediatamente — previene pérdida de datos al cerrar el panel rápido.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (dirtyRef.current.size > 0) flushDirty();
    };
  }, []);

  const saveField = useCallback((k, v) => {
    setData(p => {
      const next = { ...p, [k]: v };
      latestRef.current = next;
      dirtyRef.current.add(k);
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        if (mountedRef.current) flushDirty();
      }, 400);
      return next;
    });
  }, [flushDirty]);

  const saveFields = useCallback((fields) => {
    setData(p => {
      const next = { ...p, ...fields };
      latestRef.current = next;
      Object.keys(fields).forEach(k => dirtyRef.current.add(k));
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        if (mountedRef.current) flushDirty();
      }, 400);
      return next;
    });
  }, [flushDirty]);

  const [stateActionLoading, setStateActionLoading] = useState(false);

  // Rutea el cambio del dropdown de estado por la máquina de estados (transicionEstadoOT).
  // Si no existe una transición válida, bloquea y avisa — NUNCA actualiza el status directo.
  const handleStatusDropdownChange = (newStatus) => {
    if (newStatus === data.status) return;
    const action = getTransitionAction(data.status, newStatus);
    if (!action) {
      const fromLabel = STATUS_CFG[data.status]?.label || data.status;
      const toLabel = STATUS_CFG[newStatus]?.label || newStatus;
      toast.error(`Transición no válida: ${fromLabel} → ${toLabel}`);
      return;
    }
    handleStateAction(action);
  };

  const handleStateAction = async (accion) => {
    setStateActionLoading(true);
    // Flush de campos pendientes ANTES de la transición — si no, se pierden
    // los edits no guardados (notas, checklist, materiales). La máquina de estados
    // toca status/fechas/validador; el flush toca campos del operario. No se pisan.
    if (dirtyRef.current.size > 0) flushDirty();
    // Rechazo → abre el modal limpio (exige motivo visible para el operario).
    // El prompt() del navegador no daba feedback al operario ni validación decente.
    if (accion === 'rechazar') {
      setStateActionLoading(false);
      setRechazoOpen(true);
      return;
    }
    try {
      const extraData = {};
      if (accion === 'asignar' && data.assigned_name) {
        extraData.assigned_name = data.assigned_name;
      }
      const res = await base44.functions.invoke('transicionEstadoOT', {
        ot_id: order.id, accion, extra_data: extraData,
      });
      toast.success(res.data.mensaje);
      queryClient.invalidateQueries({ queryKey: ['workorders'] });
      queryClient.invalidateQueries({ queryKey: ['workorder-detail', order.id] });
      if (accion === 'aprobar') queryClient.invalidateQueries({ queryKey: ['workorders-validacion'] });
      if (accion === 'aprobar' || accion === 'cancelar' || accion === 'convertir_obra' || accion === 'completar') onClose();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Error al cambiar el estado';
      toast.error(msg);
    } finally {
      setStateActionLoading(false);
    }
  };

  // Confirmación del rechazo desde el modal — exige comentario no vacío.
  const confirmarRechazo = async (comentario) => {
    setRechazoOpen(false);
    setStateActionLoading(true);
    if (dirtyRef.current.size > 0) flushDirty();
    try {
      const res = await base44.functions.invoke('transicionEstadoOT', {
        ot_id: order.id, accion: 'rechazar',
        extra_data: { rechazo_comentario: comentario.trim() },
      });
      toast.success(res.data.mensaje);
      queryClient.invalidateQueries({ queryKey: ['workorders'] });
      queryClient.invalidateQueries({ queryKey: ['workorder-detail', order.id] });
      queryClient.invalidateQueries({ queryKey: ['workorders-validacion'] });
      queryClient.invalidateQueries({ queryKey: ['workorders-operario'] });
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Error al rechazar la OT';
      toast.error(msg);
    } finally {
      setStateActionLoading(false);
    }
  };

  const handleConvertToObra = async () => {
    if (!window.confirm('¿Convertir esta OT a Futura Obra? Se creará un pendiente de tipo obra y la OT quedará en estado "Obra".')) return;
    setConvertingToObra(true);
    // Flush de campos pendientes antes de convertir — mismo motivo que handleStateAction
    if (dirtyRef.current.size > 0) flushDirty();
    try {
      // 1) Primero el cambio de estado (acción principal). Si falla, no se crea
      //    ningún pendiente huérfano.
      await base44.functions.invoke('transicionEstadoOT', { ot_id: order.id, accion: 'convertir_obra' });
      // 2) Luego crear el pendiente de tipo obra, propagando sector_id y
      //    jefe_sitio_email de la OT original — preserva aislamiento entre sectores
      //    y visibilidad del jefe por RLS.
      try {
        await base44.entities.Pendiente.create({
          descripcion: data.title,
          tipo: 'obra',
          estado: 'pendiente',
          prioridad: data.priority || 'media',
          establecimiento: data.location_qr_name || '',
          sitio: data.location || '',
          jefe_sitio: data.assigned_name || '',
          jefe_sitio_email: data.jefe_sitio_email || '',
          sector_id: data.sector_id,
          materiales_necesarios: (data.materials_used || []).map(m => m.material_name).filter(Boolean).join(', '),
          observaciones: data.description || '',
          fecha_limite: data.scheduled_date || undefined,
        });
      } catch (e) {
        // La OT ya quedó en estado "obra" (acción principal OK). El pendiente es
        // tracking secundario — no se revierte el estado. Avisar al usuario.
        console.error('Pendiente de obra no se pudo crear (OT ya convertida):', e);
        toast.warning('OT convertida, pero no se pudo crear el pendiente de obra asociado');
      }
      queryClient.invalidateQueries({ queryKey: ['pendientes'] });
      queryClient.invalidateQueries({ queryKey: ['workorders'] });
      queryClient.invalidateQueries({ queryKey: ['workorder-detail', order.id] });
      toast.success('OT convertida a Futura Obra correctamente');
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Error al convertir la OT';
      toast.error(msg);
    } finally {
      setConvertingToObra(false);
    }
  };

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
  const doneCount = checklist.filter(t => t.completed).length;
  const checklistBlocked = checklist.length > 0 && doneCount < checklist.length;
  const photosBlocked = data.require_photos && (data.photos || []).length === 0;
  const canComplete = !checklistBlocked && !photosBlocked;

  const pCfg = PRIORITY_CFG[data.priority] || PRIORITY_CFG.media;
  const sCfg = STATUS_CFG[data.status] || STATUS_CFG.pendiente;

  const save = () => {
    if (checklistBlocked) { toast.warning(`Faltan ${checklist.length - doneCount} tarea(s)`); return; }
    if (photosBlocked) { toast.warning('Falta foto obligatoria'); return; }
    // Computar todos los campos modificados comparando contra freshOrder (estado del servidor)
    // y flushearlos en un solo update parcial — nunca envía el objeto completo.
    const base = freshOrder || order;
    const BUILT_IN = ['id', 'created_date', 'updated_date', 'created_by_id'];
    Object.keys(data).forEach(k => {
      if (BUILT_IN.includes(k)) return;
      if (JSON.stringify(data[k]) !== JSON.stringify(base[k])) dirtyRef.current.add(k);
    });
    if (dirtyRef.current.size === 0) { onClose(); return; }
    closeAfterSaveRef.current = true;
    flushDirty();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => { if (!saveMutation.isPending) onClose(); }} />

        {/* Panel */}
        <div
          className="relative z-10 w-full sm:max-w-lg sm:mx-4 bg-[#0d1117] sm:rounded-2xl rounded-t-2xl shadow-2xl border border-white/8 flex flex-col overflow-hidden"
          style={{ height: '93dvh', maxHeight: 'calc(100dvh - 12px)' }}
        >
          {/* ── HEADER ───────────────────────────────────────────────────── */}
          <div className="flex-shrink-0 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #1e3a5f 100%)' }}
          >
            {/* BG blobs */}
            <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-indigo-500/10 -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-blue-500/10 translate-y-1/2 -translate-x-1/2 blur-xl pointer-events-none" />

            <div className="relative px-5 pt-5 pb-4 pr-14">
              {/* Code + title */}
              <p className="text-[10px] text-white/40 font-mono mb-1 tracking-widest">
                {data.code || `OT-${order.id?.slice(-6)?.toUpperCase()}`}
              </p>
              <h2 className="text-base sm:text-[17px] font-bold text-white leading-snug mb-3 line-clamp-2">
                {data.title}
              </h2>

              {/* Pill badges */}
              <div className="flex flex-wrap gap-1.5">
                {/* Priority */}
                <span className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full border font-medium ${pCfg.pill}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${pCfg.dot}`} />
                  {pCfg.label}
                </span>
                {/* Type */}
                <span className="text-[11px] px-2.5 py-0.5 rounded-full border border-white/15 bg-white/8 text-white/70 font-medium">
                  {TYPE_LABELS[data.type] || data.type}
                </span>
                {/* Status */}
                <span className={`text-[11px] px-2.5 py-0.5 rounded-full border font-semibold ${sCfg.color} ${sCfg.bg}`}>
                  {sCfg.label}
                </span>
              </div>

              {/* Meta row */}
              <div className="flex flex-wrap gap-2 mt-2.5">
                {data.location && (
                  <span className="flex items-center gap-1 text-[11px] text-white/55">
                    <MapPin className="h-3 w-3 text-white/30 flex-shrink-0" />
                    {data.location}
                  </span>
                )}
                {data.assigned_name && (
                  <span className="flex items-center gap-1 text-[11px] text-white/55">
                    <User className="h-3 w-3 text-white/30 flex-shrink-0" />
                    {data.assigned_name}
                  </span>
                )}
                {data.scheduled_date && (
                  <span className="flex items-center gap-1 text-[11px] text-white/55">
                    <Calendar className="h-3 w-3 text-white/30 flex-shrink-0" />
                    {data.scheduled_date}
                  </span>
                )}
                <span className="flex items-center gap-1 text-[11px] text-white/55">
                  <User className="h-3 w-3 text-white/30 flex-shrink-0" />
                  {creadorLabel} {creadorPor}
                </span>
              </div>
            </div>

            {/* Close */}
            <button onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all">
              <X className="h-4 w-4" />
            </button>
            {loadingFresh && (
              <div className="absolute top-4 right-14">
                <RefreshCw className="h-3.5 w-3.5 text-white/30 animate-spin" />
              </div>
            )}
          </div>

          {/* ── QUICK CONTROLS ───────────────────────────────────────────── */}
          <div className="flex-shrink-0 grid grid-cols-3 gap-2 px-4 py-3 bg-slate-900/80 border-b border-white/6">
            <div>
              <p className="text-[9px] uppercase tracking-widest text-slate-500 mb-1.5">Estado</p>
              <Select value={data.status} onValueChange={handleStatusDropdownChange}>
                <SelectTrigger className="h-8 text-[11px] bg-slate-800/80 border-white/10 text-white rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CFG).map(([val, cfg]) => (
                    <SelectItem key={val} value={val} className="text-xs">{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {checklistBlocked && (
                <p className="text-[9px] text-orange-400 mt-1 flex items-center gap-0.5">
                  <AlertTriangle className="h-2.5 w-2.5" />{doneCount}/{checklist.length} hechas
                </p>
              )}
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest text-slate-500 mb-1.5">Responsable</p>
              <Input value={data.assigned_name || ''} placeholder="Nombre del responsable…"
                onChange={handleAssignedNameChange}
                onBlur={handleAssignedNameBlur}
                className="h-8 text-[11px] bg-slate-800/80 border-white/10 text-white rounded-lg px-2" />
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest text-slate-500 mb-1.5">Fecha</p>
              <Input type="date" value={data.scheduled_date || ''}
                onChange={e => saveField('scheduled_date', e.target.value)}
                className="h-8 text-[11px] bg-slate-800/80 border-white/10 text-white rounded-lg px-2" />
            </div>
          </div>

          {/* ── STATE MACHINE ACTIONS ────────────────────────────────────── */}
          {getAvailableActions(data.status).length > 0 && data.status !== 'pendiente_validacion' && (
            <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-slate-900/80 border-b border-white/6">
              {getAvailableActions(data.status).map(act => (
                <button
                  key={act.accion}
                  onClick={() => handleStateAction(act.accion)}
                  disabled={stateActionLoading}
                  className={`flex-1 h-8 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 ${ACTION_VARIANTS[act.variant]}`}
                >
                  {stateActionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {act.label}
                </button>
              ))}
            </div>
          )}

          {/* ── BODY ─────────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">

            {/* ── Reporte del operario (solo en validación) ──
                El jefe revisa la tarea resuelta antes de aprobar/rechazar.
                Reemplaza la barra superior de acciones en este estado. */}
            {data.status === 'pendiente_validacion' && (
              <ReporteOperarioResumen
                ot={data}
                onAprobar={() => handleStateAction('aprobar')}
                onRechazar={() => setRechazoOpen(true)}
                loading={stateActionLoading}
              />
            )}

            {/* ── Sin ubicación — editor destacado ── */}
            {(!data.location || data.location.trim() === '') && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-900/30 border-b border-amber-500/20">
                  <MapPin className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-300">Asignar ubicación</span>
                </div>
                <div className="px-4 py-3">
                  <LocationEditor
                    currentLocation={data.location || ''}
                    currentAssigned={data.assigned_name || ''}
                    onSave={(fields) => {
                      saveFields(fields);
                      toast.success('Ubicación asignada correctamente');
                    }}
                  />
                </div>
              </div>
            )}

            {/* ── Instrucciones ── */}
            {data.description && (
              <CollapseSection icon={FileText} title="Instrucciones" defaultOpen>
                <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{data.description}</p>
              </CollapseSection>
            )}

            {/* ── Checklist ── */}
            <CollapseSection
              icon={CheckSquare}
              title="Checklist"
              badge={checklist.length > 0 ? `${doneCount}/${checklist.length}` : null}
              defaultOpen
            >
              {checklist.length > 0 && (
                <div className="mb-3 flex items-center gap-3">
                  <MiniRing value={doneCount} total={checklist.length} color={doneCount === checklist.length ? '#10b981' : '#6366f1'} />
                  <div>
                    <p className="text-xs font-semibold text-slate-200">{doneCount === checklist.length ? '¡Todo completado!' : `${checklist.length - doneCount} tarea(s) pendiente(s)`}</p>
                    <p className="text-[10px] text-slate-500">{Math.round((doneCount / checklist.length) * 100)}% del trabajo listo</p>
                  </div>
                </div>
              )}
              <WorkOrderChecklist checklist={checklist} onChange={val => saveField('checklist', val)} />
            </CollapseSection>

            {/* ── GPS ── */}
            {data.gps_status && (
              <CollapseSection icon={Navigation} title="Ubicación GPS" defaultOpen={false}>
                {data.gps_status === 'capturado' ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-emerald-300 font-mono">{data.gps_latitude?.toFixed(5)}, {data.gps_longitude?.toFixed(5)}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Precisión: {data.gps_accuracy ? `±${Math.round(data.gps_accuracy)}m` : 'N/D'}</p>
                    </div>
                    <a href={`https://www.google.com/maps?q=${data.gps_latitude},${data.gps_longitude}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-[11px] bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/40 rounded-lg px-3 py-1.5 transition-colors">
                      Ver mapa
                    </a>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    {data.gps_status === 'denegado' ? 'Permiso denegado' : 'No disponible'}
                  </p>
                )}
              </CollapseSection>
            )}

            {/* ── Materiales ── */}
            <CollapseSection
              icon={Package}
              title="Materiales"
              badge={(data.materials_used || []).length || null}
              defaultOpen={false}
            >
              <WorkOrderMaterials
                materials={data.materials_used || []}
                faltantes={data.materiales_faltantes || []}
                onChangeMaterials={val => saveField('materials_used', val)}
                onChangeFaltantes={val => saveField('materiales_faltantes', val)}
              />
            </CollapseSection>

            {/* ── Media ── */}
            <CollapseSection
              icon={Camera}
              title="Fotos & Firma"
              badge={(data.photos || []).length || null}
              defaultOpen={false}
            >
              <div className="space-y-4">
                <WorkOrderPhotos photos={data.photos || []} onChange={val => saveField('photos', val)} />
                <div className="border-t border-slate-700/50 pt-4">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Firma de conformidad</p>
                  <WorkOrderSignature
                    signatureUrl={data.signature_url}
                    signatureName={data.signature_name}
                    onChange={({ signatureUrl, signatureName }) =>
                      saveFields({ signature_url: signatureUrl, signature_name: signatureName })}
                  />
                </div>
              </div>
            </CollapseSection>

            {/* ── Notas ── */}
            <CollapseSection icon={Zap} title="Notas" defaultOpen={false}>
              <textarea
                className="w-full bg-slate-950/50 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500/50 min-h-[90px]"
                placeholder="Agregar observaciones..."
                value={data.notes || ''}
                onChange={e => saveField('notes', e.target.value)}
              />
            </CollapseSection>

            {/* ── Incompleto ── */}
            <CollapseSection icon={ClipboardX} title="Motivos Incompleto" accent defaultOpen={false}>
              <WorkOrderIncompleteReason
                motivos={data.motivos_incompleto || []}
                onChange={val => saveField('motivos_incompleto', val)}
              />
            </CollapseSection>

          </div>

          {/* ── FOOTER ───────────────────────────────────────────────────── */}
          <div className="flex-shrink-0 border-t border-white/6 bg-slate-900/90 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              {/* Tools */}
              <div className="flex items-center gap-1">
                <button onClick={() => exportWorkOrderPDF(data, [])} title="PDF"
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-colors">
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button onClick={handleSaveAsTemplate} disabled={savingTemplate} title="Guardar plantilla"
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-colors disabled:opacity-40">
                  {savingTemplate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => setQrOpen(true)} title="QR"
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-colors">
                  <QrCode className="h-3.5 w-3.5" />
                </button>
                <button onClick={handleConvertToObra} disabled={convertingToObra} title="Convertir a Futura Obra"
                  className="h-8 px-2 flex items-center gap-1 rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/60 transition-colors disabled:opacity-40 text-[10px] font-semibold">
                  {convertingToObra ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}
                  Obra
                </button>
                {onDelete && <DeleteWorkOrderButton order={data} onDelete={onDelete} />}
              </div>

              {/* Save */}
              <div className="flex items-center gap-2">
                <button onClick={onClose}
                  className="text-xs text-slate-400 hover:text-white px-3 py-2 rounded-lg border border-white/10 hover:border-white/20 transition-colors">
                  Cerrar
                </button>
                <button onClick={save}
                  disabled={saveMutation.isPending}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-lg px-4 py-2 transition-all disabled:opacity-50 shadow-lg shadow-indigo-950/50">
                  {saveMutation.isPending
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Guardando</>
                    : <><Save className="h-3.5 w-3.5" />Guardar</>
                  }
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

      <RechazoOTModal
        open={rechazoOpen}
        onClose={() => setRechazoOpen(false)}
        onConfirm={confirmarRechazo}
        loading={stateActionLoading}
      />
    </>
  );
}