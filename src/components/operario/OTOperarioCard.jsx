import React from 'react';
import { Clock, MapPin, AlertCircle, Wrench, CheckCircle, ChevronRight } from 'lucide-react';
import { format, parseISO, isPast } from 'date-fns';
import { es } from 'date-fns/locale';

const STATUS_CONFIG = {
  pendiente:    { label: 'Pendiente',    color: 'text-amber-400',   bg: 'bg-amber-400/10',  icon: Clock },
  asignada:     { label: 'Asignada',     color: 'text-blue-400',    bg: 'bg-blue-400/10',   icon: Clock },
  en_progreso:  { label: 'En Progreso',  color: 'text-sky-400',     bg: 'bg-sky-400/10',    icon: Wrench },
  completada:   { label: 'Completada',   color: 'text-emerald-400', bg: 'bg-emerald-400/10',icon: CheckCircle },
  cancelada:    { label: 'Cancelada',    color: 'text-slate-400',   bg: 'bg-slate-400/10',  icon: AlertCircle },
};

const PRIORITY_COLOR = {
  baja:    'border-l-slate-500',
  media:   'border-l-blue-500',
  alta:    'border-l-amber-500',
  urgente: 'border-l-red-500',
};

export default function OTOperarioCard({ ot, onOpen }) {
  const cfg = STATUS_CONFIG[ot.status] || STATUS_CONFIG.pendiente;
  const StatusIcon = cfg.icon;
  const isOverdue = ot.scheduled_date && isPast(new Date(ot.scheduled_date + 'T23:59:59')) && ot.status !== 'completada' && ot.status !== 'cancelada';

  return (
    <button
      onClick={onOpen}
      className={`w-full text-left bg-slate-900/60 border border-slate-800 border-l-4 ${PRIORITY_COLOR[ot.priority] || 'border-l-slate-700'} rounded-xl p-4 hover:bg-slate-800/60 transition-all group`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.bg} ${cfg.color}`}>
          <StatusIcon className="h-2.5 w-2.5" />
          {cfg.label}
        </span>
        <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transition-colors flex-shrink-0 mt-0.5" />
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-white leading-snug mb-1 line-clamp-2">{ot.title}</h3>

      {/* Location */}
      {ot.location && (
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
          <MapPin className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{ot.location}</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-3 pt-3 border-t border-slate-800">
        <span className="uppercase tracking-wide font-medium">{ot.type?.replace(/_/g, ' ')}</span>
        {ot.scheduled_date && (
          <span className={isOverdue ? 'text-red-400 font-semibold' : ''}>
            {isOverdue ? '⚠ ' : ''}
            {format(parseISO(ot.scheduled_date), 'dd MMM yyyy', { locale: es })}
          </span>
        )}
      </div>
    </button>
  );
}