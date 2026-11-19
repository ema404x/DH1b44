import React from 'react';
import { MapPin, Play, Flag, Lock, Loader2, WifiOff, CalendarDays } from 'lucide-react';
import { parseFechaLocal } from '@/lib/fechaLocal';

const PRIO = {
  urgente: { label: 'Urgente', cls: 'bg-red-500 text-white', rail: 'bg-red-500' },
  alta: { label: 'Alta', cls: 'bg-orange-500 text-white', rail: 'bg-orange-500' },
  media: { label: 'Media', cls: 'bg-sky-500/20 text-sky-300', rail: 'bg-sky-500' },
  baja: { label: 'Baja', cls: 'bg-slate-600 text-slate-200', rail: 'bg-slate-500' },
};

function fecha(ot) {
  try {
    const d = ot.scheduled_date ? parseFechaLocal(ot.scheduled_date) : ot.created_date ? new Date(ot.created_date) : null;
    return d ? d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) : '';
  } catch { return ''; }
}

/** Tarjeta táctil de OT del Inicio operario con su acción principal. */
export default function OperarioOTCard({ ot, onIniciar, onFinalizar, processing, pendingSync }) {
  const prio = PRIO[ot.priority] || PRIO.media;
  const f = fecha(ot);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 pl-5">
      <div className={`absolute inset-y-0 left-0 w-1.5 ${prio.rail}`} />
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold leading-snug text-card-foreground line-clamp-2">{ot.title}</h3>
        <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase ${prio.cls}`}>{prio.label}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        {ot.location && <span className="flex min-w-0 items-center gap-1"><MapPin className="h-4 w-4 shrink-0" /><span className="truncate">{ot.location}</span></span>}
        {f && <span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" />{f}</span>}
        {pendingSync && <span className="flex items-center gap-1 text-amber-300"><WifiOff className="h-4 w-4" />Por enviar</span>}
      </div>
      {ot.rechazo_comentario && (
        <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">Tu jefe pidió: {ot.rechazo_comentario}</p>
      )}
      <div className="mt-3">
        {onIniciar ? (
          <button onClick={onIniciar} disabled={processing} className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-lg font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-50">
            {processing ? <Loader2 className="h-6 w-6 animate-spin" /> : <Play className="h-6 w-6" />} Iniciar
          </button>
        ) : onFinalizar ? (
          <button onClick={onFinalizar} disabled={processing} className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-lg font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-50">
            {processing ? <Loader2 className="h-6 w-6 animate-spin" /> : <Flag className="h-6 w-6" />} Finalizar
          </button>
        ) : (
          <div className="flex h-12 items-center justify-center gap-2 rounded-xl bg-muted/40 text-sm font-medium text-muted-foreground">
            <Lock className="h-4 w-4" /> Esperando a tu jefe
          </div>
        )}
      </div>
    </div>
  );
}