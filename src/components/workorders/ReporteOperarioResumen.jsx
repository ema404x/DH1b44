import React from 'react';
import {
  User, Clock, CheckSquare, Package, AlertTriangle, Camera, Navigation,
  MessageSquare, ClipboardX, CheckCircle2, XCircle, Loader2,
} from 'lucide-react';

// Resumen de solo lectura del reporte que envió el operario al finalizar la OT.
// Se muestra en WorkOrderDetailPanel cuando la OT está en "pendiente_validacion"
// para que el Jefe de Sitio revise la tarea resuelta ANTES de aprobar/rechazar,
// en lugar de operar a ciegas con el título original de la OT.

function fmtFecha(fecha) {
  if (!fecha) return '—';
  try {
    const d = new Date(fecha);
    return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return fecha;
  }
}

export default function ReporteOperarioResumen({ ot, onAprobar, onRechazar, loading }) {
  const checklist = ot.checklist || [];
  const done = checklist.filter(t => t.completed).length;
  const total = checklist.length;
  const pct = total ? Math.round((done / total) * 100) : 100;
  const fotos = ot.photos || [];
  const materiales = ot.materials_used || [];
  const faltantes = ot.materiales_faltantes || [];
  const motivos = (ot.motivos_incompleto || []).filter(m => m.texto && m.texto.trim());
  const gpsOk = ot.gps_status === 'capturado' && ot.gps_latitude != null;

  const todoCompleto = total === 0 || done === total;
  const fotosOk = !ot.require_photos || fotos.length > 0;
  const hayFaltantes = faltantes.length > 0;

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-950/15 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-900/30 border-b border-amber-500/20">
        <ClipboardX className="h-3.5 w-3.5 text-amber-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
          Reporte del Operario — esperando tu validación
        </span>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Quién y cuándo */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-300">
          <span className="flex items-center gap-1">
            <User className="h-3 w-3 text-slate-500" /> {ot.assigned_name || 'Sin asignar'}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-slate-500" /> Inicio real: {fmtFecha(ot.fecha_inicio_real)}
          </span>
        </div>

        {/* Checklist resumen */}
        {total > 0 && (
          <div className="flex items-center justify-between bg-slate-900/40 rounded-lg px-3 py-2 border border-slate-700/40">
            <div className="flex items-center gap-2">
              <CheckSquare className={`h-4 w-4 ${todoCompleto ? 'text-emerald-400' : 'text-amber-400'}`} />
              <span className="text-xs font-semibold text-slate-200">Checklist</span>
            </div>
            <div className="text-right">
              <p className={`text-sm font-bold ${todoCompleto ? 'text-emerald-300' : 'text-amber-300'}`}>{done}/{total}</p>
              <p className="text-[10px] text-slate-500">{pct}% completado</p>
            </div>
          </div>
        )}

        {/* Materiales usados */}
        {materiales.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
              <Package className="h-3 w-3" /> Materiales usados ({materiales.length})
            </p>
            <ul className="space-y-1">
              {materiales.map((m, i) => (
                <li key={i} className="text-xs text-slate-300 flex justify-between bg-slate-900/40 rounded px-2 py-1">
                  <span>{m.material_name}</span>
                  <span className="text-slate-500 tabular-nums">
                    {m.quantity != null ? `${m.quantity}` : ''}
                    {m.unit_cost != null ? ` · $${m.unit_cost}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Faltantes */}
        {hayFaltantes && (
          <div className="bg-red-950/20 border border-red-500/30 rounded-lg p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-red-400 mb-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Materiales faltantes ({faltantes.length})
            </p>
            <ul className="space-y-1">
              {faltantes.map((m, i) => (
                <li key={i} className="text-xs text-red-200">
                  <span className="font-medium">{m.material_name}</span>
                  {m.cantidad_faltante != null ? ` — faltaron ${m.cantidad_faltante}` : ''}
                  {m.motivo ? (
                    <span className="block text-[11px] text-red-300/80">Motivo: {m.motivo}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Fotos */}
        {fotos.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
              <Camera className="h-3 w-3" /> Fotos del trabajo ({fotos.length})
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {fotos.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                  className="aspect-square rounded-md overflow-hidden border border-slate-700/50 hover:border-amber-500/50 transition-colors">
                  <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* GPS */}
        {gpsOk && (
          <div className="flex items-center justify-between bg-slate-900/40 rounded-lg px-3 py-2 border border-slate-700/40">
            <div className="flex items-center gap-2">
              <Navigation className="h-3.5 w-3.5 text-emerald-400" />
              <div>
                <p className="text-xs text-emerald-300 font-mono">
                  {ot.gps_latitude?.toFixed(5)}, {ot.gps_longitude?.toFixed(5)}
                </p>
                <p className="text-[10px] text-slate-500">
                  Precisión: {ot.gps_accuracy ? `±${Math.round(ot.gps_accuracy)}m` : 'N/D'}
                </p>
              </div>
            </div>
            <a href={`https://www.google.com/maps?q=${ot.gps_latitude},${ot.gps_longitude}`}
              target="_blank" rel="noopener noreferrer"
              className="text-[11px] bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/40 rounded-lg px-2.5 py-1 transition-colors">
              Ver mapa
            </a>
          </div>
        )}

        {/* Notas del operario */}
        {ot.notes && ot.notes.trim() && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
              <MessageSquare className="h-3 w-3" /> Notas del operario
            </p>
            <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap bg-slate-900/40 rounded-lg px-2.5 py-2 border border-slate-700/40">
              {ot.notes}
            </p>
          </div>
        )}

        {/* Motivos incompleto */}
        {motivos.length > 0 && (
          <div className="bg-orange-950/20 border border-orange-500/30 rounded-lg p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-orange-400 mb-1 flex items-center gap-1">
              <ClipboardX className="h-3 w-3" /> Motivos de trabajo incompleto
            </p>
            <ul className="space-y-0.5">
              {motivos.map((m, i) => (
                <li key={i} className="text-xs text-orange-200">• {m.texto}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Rechazo anterior (si fue rechazada y re-finalizada) */}
        {ot.rechazo_comentario && (
          <div className="bg-red-950/20 border border-red-500/30 rounded-lg p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-red-400 mb-1">Rechazo anterior</p>
            <p className="text-xs text-red-200">{ot.rechazo_comentario}</p>
          </div>
        )}

        {/* Alertas de bloqueo para el jefe */}
        {(!todoCompleto || !fotosOk) && (
          <div className="flex items-start gap-2 bg-orange-950/30 border border-orange-500/40 rounded-lg px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-orange-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-orange-200 leading-snug">
              {!todoCompleto && `Faltan ${total - done} tarea(s) del checklist. `}
              {!fotosOk && 'La OT requiere al menos una foto. '}
              Si hay motivos de incompleto registrados el sistema permite aprobar; si no, rechazá y devolvé al operario.
            </p>
          </div>
        )}

        {/* Botones de decisión */}
        <div className="flex gap-2 pt-1">
          <button onClick={onRechazar} disabled={loading}
            className="flex-1 h-11 rounded-lg bg-red-600/15 border border-red-500/40 text-red-300 text-sm font-bold hover:bg-red-600/25 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
            Rechazar y devolver
          </button>
          <button onClick={onAprobar} disabled={loading}
            className="flex-[1.4] h-11 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-emerald-950/40">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Aprobar y completar
          </button>
        </div>
      </div>
    </div>
  );
}