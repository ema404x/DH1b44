import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  CheckCircle2, Clock, MapPin, Loader2, AlertTriangle,
  Wrench, Zap, Eye, ClipboardList, User, Calendar,
  Phone, ChevronDown, ChevronUp, Package
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const typeConfig = {
  mantenimiento_preventivo: { label: 'Mantenimiento Preventivo', icon: Wrench, color: 'bg-blue-100 text-blue-700' },
  mantenimiento_correctivo: { label: 'Mantenimiento Correctivo', icon: Wrench, color: 'bg-orange-100 text-orange-700' },
  instalacion:   { label: 'Instalación',  icon: Zap,          color: 'bg-purple-100 text-purple-700' },
  inspeccion:    { label: 'Inspección',   icon: Eye,           color: 'bg-teal-100 text-teal-700' },
  reparacion:    { label: 'Reparación',   icon: Wrench,        color: 'bg-amber-100 text-amber-700' },
  emergencia:    { label: 'EMERGENCIA',   icon: AlertTriangle, color: 'bg-red-100 text-red-700' },
};

const statusConfig = {
  pendiente:   { label: 'Pendiente',   dot: 'bg-slate-400',  text: 'text-slate-600',  bg: 'bg-slate-50' },
  asignada:    { label: 'Asignada',    dot: 'bg-blue-500',   text: 'text-blue-700',   bg: 'bg-blue-50' },
  en_progreso: { label: 'En Progreso', dot: 'bg-indigo-500', text: 'text-indigo-700', bg: 'bg-indigo-50' },
  en_espera:   { label: 'En Espera',   dot: 'bg-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50' },
  completada:  { label: 'Completada',  dot: 'bg-emerald-500',text: 'text-emerald-700',bg: 'bg-emerald-50' },
  cancelada:   { label: 'Cancelada',   dot: 'bg-red-400',    text: 'text-red-600',    bg: 'bg-red-50' },
};

const priorityConfig = {
  baja:    { label: 'Baja',    color: 'bg-slate-100 text-slate-600' },
  media:   { label: 'Media',   color: 'bg-blue-100 text-blue-700' },
  alta:    { label: 'Alta',    color: 'bg-orange-100 text-orange-700' },
  urgente: { label: '🚨 URGENTE', color: 'bg-red-100 text-red-700' },
};

function ChecklistItem({ item }) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border ${item.completed ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
      <div className={`h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${item.completed ? 'bg-emerald-500' : 'border-2 border-slate-300'}`}>
        {item.completed && <CheckCircle2 className="h-4 w-4 text-white" />}
      </div>
      <div className="flex-1">
        <p className={`text-sm font-medium ${item.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>{item.task}</p>
        {item.notes && <p className="text-xs text-slate-500 mt-0.5">{item.notes}</p>}
      </div>
    </div>
  );
}

export default function OrdenTrabajoPublica() {
  const params = new URLSearchParams(window.location.search);
  const otId = params.get('ot');

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showChecklist, setShowChecklist] = useState(true);
  const [showMaterials, setShowMaterials] = useState(false);

  useEffect(() => {
    if (!otId) {
      setError('QR inválido. No se encontró la orden de trabajo.');
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        const res = await base44.functions.invoke('publicFichar', {
          action: 'getWorkOrder',
          workOrderId: otId,
        });
        const ot = res.data?.workOrder;
        if (!ot) {
          setError('Orden de trabajo no encontrada.');
          setLoading(false);
          return;
        }
        // Si la orden está activa, redirigir automáticamente a ejecutar
        if (!['completada', 'cancelada'].includes(ot.status)) {
          window.location.replace(`/ejecutar-ot?ot=${otId}`);
          return;
        }
        setOrder(ot);
      } catch (e) {
        setError('Error al cargar la orden. Intentá de nuevo.');
      }
      setLoading(false);
    };
    load();
  }, [otId]);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="text-center">
        <Loader2 className="h-10 w-10 text-white/50 animate-spin mx-auto mb-4" />
        <p className="text-white/40 text-sm">Cargando orden de trabajo...</p>
      </div>
    </div>
  );

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
        <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-8 w-8 text-red-500" />
        </div>
        <h2 className="font-bold text-xl mb-2">QR no válido</h2>
        <p className="text-slate-500 text-sm">{error}</p>
      </div>
    </div>
  );

  const tc = typeConfig[order.type] || typeConfig.mantenimiento_correctivo;
  const sc = statusConfig[order.status] || statusConfig.pendiente;
  const pc = priorityConfig[order.priority] || priorityConfig.media;
  const TypeIcon = tc.icon;
  const checklistTotal = order.checklist?.length || 0;
  const checklistDone = order.checklist?.filter(t => t.completed).length || 0;
  const pct = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;
  const isEmergencia = order.priority === 'urgente' || order.type === 'emergencia';

  return (
    <div className={`min-h-screen ${isEmergencia ? 'bg-gradient-to-br from-red-700 to-red-900' : 'bg-gradient-to-br from-slate-800 to-slate-900'}`}>

      {/* Top bar */}
      <div className="text-center pt-8 pb-5 px-4">
        <img
          src="https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/7a2959dd1_image.png"
          alt="DH1 Software"
          className="h-8 object-contain mix-blend-screen mx-auto mb-5 opacity-80"
        />
        <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold mb-3 ${tc.color}`}>
          <TypeIcon className="h-4 w-4" />
          {tc.label}
        </div>
        <h1 className="text-white font-bold text-2xl leading-tight px-2">{order.title}</h1>
        {order.code && <p className="text-white/40 text-xs font-mono mt-1">{order.code}</p>}
      </div>

      {/* Main card */}
      <div className="px-4 pb-8 max-w-md mx-auto space-y-3">

        {/* Status + Priority */}
        <div className="bg-white rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className={`flex-1 flex items-center gap-2.5 px-4 py-3 rounded-xl ${sc.bg}`}>
              <div className={`h-3 w-3 rounded-full flex-shrink-0 ${sc.dot} animate-pulse`} />
              <span className={`font-bold text-base ${sc.text}`}>{sc.label}</span>
            </div>
            <span className={`px-3 py-1.5 rounded-xl text-sm font-bold ${pc.color}`}>{pc.label}</span>
          </div>

          {/* Info rows */}
          <div className="space-y-3">
            {order.location && (
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <MapPin className="h-5 w-5 text-slate-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase">Establecimiento</p>
                  <p className="text-base font-bold text-slate-800">{order.location}</p>
                </div>
              </div>
            )}
            {order.asset_name && (
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <Wrench className="h-5 w-5 text-slate-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase">Equipo / Activo</p>
                  <p className="text-base font-bold text-slate-800">{order.asset_name}</p>
                </div>
              </div>
            )}
            {order.assigned_name && (
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <User className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase">Asignado a</p>
                  <p className="text-base font-bold text-slate-800">{order.assigned_name}</p>
                </div>
              </div>
            )}
            {order.scheduled_date && (
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Calendar className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase">Fecha programada</p>
                  <p className="text-base font-bold text-slate-800">
                    {format(parseISO(order.scheduled_date), "EEEE d 'de' MMMM yyyy", { locale: es })}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {order.description && (
          <div className="bg-white rounded-2xl p-5 shadow-lg">
            <p className="text-xs text-slate-400 font-bold uppercase mb-2 flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> Descripción de la tarea
            </p>
            <p className="text-slate-800 text-base leading-relaxed">{order.description}</p>
          </div>
        )}

        {/* Checklist */}
        {checklistTotal > 0 && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <button
              onClick={() => setShowChecklist(v => !v)}
              className="w-full flex items-center justify-between p-5"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-slate-800">Lista de tareas</p>
                  <p className="text-xs text-slate-400">{checklistDone} de {checklistTotal} completadas</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${pct === 100 ? 'text-emerald-600' : 'text-slate-600'}`}>{pct}%</span>
                {showChecklist ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
              </div>
            </button>

            {/* Progress bar */}
            <div className="px-5 pb-3">
              <div className="w-full bg-slate-100 rounded-full h-2.5">
                <div
                  className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {showChecklist && (
              <div className="px-4 pb-4 space-y-2">
                {order.checklist.map((item, idx) => (
                  <ChecklistItem key={item.id || idx} item={item} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Materials */}
        {order.materials_used?.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <button
              onClick={() => setShowMaterials(v => !v)}
              className="w-full flex items-center justify-between p-5"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <Package className="h-5 w-5 text-indigo-600" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-slate-800">Materiales</p>
                  <p className="text-xs text-slate-400">{order.materials_used.length} ítem(s)</p>
                </div>
              </div>
              {showMaterials ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
            </button>
            {showMaterials && (
              <div className="px-4 pb-4 space-y-2">
                {order.materials_used.map((mat, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-sm font-medium text-slate-800">{mat.material_name}</span>
                    <span className="text-sm font-bold text-slate-600">× {mat.quantity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        {order.notes && (
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-5">
            <p className="text-white/50 text-xs font-bold uppercase mb-2">Notas</p>
            <p className="text-white/80 text-sm leading-relaxed">{order.notes}</p>
          </div>
        )}

        {/* CTA — Ejecutar OT */}
        {!['completada', 'cancelada'].includes(order.status) && (
          <div className="sticky bottom-4">
            <a
              href={`/ejecutar-ot?ot=${otId}`}
              className="flex items-center justify-center gap-3 w-full h-16 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold text-lg shadow-xl shadow-emerald-900/40 transition-all"
            >
              <Wrench className="h-6 w-6" />
              Ejecutar esta orden
            </a>
          </div>
        )}

        {order.status === 'completada' && (
          <div className="flex items-center justify-center gap-2 py-4 text-emerald-400 font-semibold">
            <CheckCircle2 className="h-5 w-5" />
            Esta orden ya fue completada
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-2 pb-8">
          <img
            src="https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/7a2959dd1_image.png"
            alt="DH1 Software"
            className="h-6 object-contain mix-blend-screen mx-auto mb-2 opacity-50"
          />
          <p className="text-white/25 text-xs">DH1 Software · Sistema de Gestión</p>
        </div>
      </div>
    </div>
  );
}