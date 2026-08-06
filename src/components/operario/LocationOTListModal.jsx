import React from 'react';
import { MapPin, X, Play, Flag, Lock, CheckCircle2, ClipboardList, Loader2, AlertCircle, ScanLine } from 'lucide-react';

const TYPE_LABEL = {
  mantenimiento_preventivo: 'Mant. Preventivo',
  mantenimiento_correctivo: 'Mant. Correctivo',
  instalacion: 'Instalación',
  inspeccion: 'Inspección',
  reparacion: 'Reparación',
  emergencia: '🚨 Emergencia',
};

const STATUS_BADGE = {
  pendiente:   { label: 'Pendiente',   cls: 'bg-amber-400/10 text-amber-400 border-amber-400/20' },
  asignada:    { label: 'Asignada',    cls: 'bg-blue-400/10 text-blue-400 border-blue-400/20' },
  en_progreso: { label: 'En Progreso', cls: 'bg-sky-400/10 text-sky-400 border-sky-400/20' },
  pendiente_validacion: { label: 'En Validación', cls: 'bg-purple-400/10 text-purple-400 border-purple-400/20' },
  completada:  { label: 'Completada',  cls: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' },
  cancelada:   { label: 'Cancelada',   cls: 'bg-red-400/10 text-red-400 border-red-400/20' },
};

export default function LocationOTListModal({ open, onClose, orders, locationName, onSelect, loading, error, onRetry, onScanAnother }) {
  if (!open) return null;

  const safeOrders = orders || [];
  const activas = safeOrders.filter(o => !['completada', 'cancelada'].includes(o.status));
  const completadas = safeOrders.filter(o => o.status === 'completada');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[85vh] flex flex-col bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 shrink-0">
          <div className="h-10 w-10 bg-primary/15 rounded-xl flex items-center justify-center shrink-0">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white truncate">{locationName || 'Ubicación'}</h3>
            <p className="text-xs text-slate-500">
              {error ? 'Error al cargar' : `${activas.length} OT activa${activas.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          {onScanAnother && (
            <button onClick={onScanAnother} title="Escanear otra ubicación"
              className="h-9 w-9 flex items-center justify-center rounded-lg bg-primary/15 border border-primary/25 hover:bg-primary/25 transition-colors shrink-0">
              <ScanLine className="h-5 w-5 text-primary" />
            </button>
          )}
          <button onClick={onClose} className="text-slate-400 hover:text-white shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Lista scrolleable */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
          {loading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          )}

          {!loading && error && (
            <div className="text-center py-10 flex flex-col items-center gap-3">
              <AlertCircle className="h-12 w-12 text-red-400/80" />
              <p className="text-sm text-slate-300">No pudimos cargar las OTs de esta ubicación</p>
              <button onClick={onRetry} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold">
                Reintentar
              </button>
            </div>
          )}

          {!loading && !error && safeOrders.length === 0 && (
            <div className="text-center py-10 flex flex-col items-center gap-2">
              <ClipboardList className="h-12 w-12 text-slate-700" />
              <p className="text-sm text-slate-400">No hay OTs activas en esta ubicación</p>
              <p className="text-xs text-slate-600">Acercá un código cuando haya tareas asignadas</p>
            </div>
          )}

          {activas.length > 0 && (
            <>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                Activas ({activas.length})
              </p>
              {activas.map(ot => {
                const badge = STATUS_BADGE[ot.status] || STATUS_BADGE.pendiente;
                return (
                  <button
                    key={ot.id}
                    onClick={() => onSelect(ot)}
                    className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 text-left hover:border-primary/40 hover:bg-slate-800 transition-colors flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <span className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${badge.cls} mb-1.5`}>
                        {badge.label}
                      </span>
                      <p className="text-sm font-semibold text-white leading-tight truncate">{ot.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{TYPE_LABEL[ot.type] || ot.type}</p>
                      {ot.location && (
                        <p className="text-[11px] text-slate-600 mt-1 flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3 shrink-0" /> {ot.location}
                        </p>
                      )}
                    </div>
                    {ot.status === 'pendiente' || ot.status === 'asignada' ? (
                      <div className="h-9 w-9 rounded-lg bg-blue-600/15 border border-blue-600/30 flex items-center justify-center shrink-0">
                        <Play className="h-4 w-4 text-blue-400" />
                      </div>
                    ) : ot.status === 'en_progreso' ? (
                      <div className="h-9 w-9 rounded-lg bg-emerald-600/15 border border-emerald-600/30 flex items-center justify-center shrink-0">
                        <Flag className="h-4 w-4 text-emerald-400" />
                      </div>
                    ) : ot.status === 'pendiente_validacion' ? (
                      <div className="h-9 w-9 rounded-lg bg-purple-600/15 border border-purple-600/30 flex items-center justify-center shrink-0">
                        <Lock className="h-4 w-4 text-purple-400" />
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </>
          )}

          {completadas.length > 0 && (
            <>
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider px-1 pt-2">
                Completadas ({completadas.length})
              </p>
              {completadas.map(ot => (
                <div key={ot.id} className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-3 flex items-center gap-3 opacity-50">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                  <p className="text-sm text-slate-400 font-medium line-through truncate">{ot.title}</p>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}