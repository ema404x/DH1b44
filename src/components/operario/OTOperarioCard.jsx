import React from 'react';
import { Clock, MapPin, AlertCircle, Wrench, CheckCircle, ChevronRight, Calendar } from 'lucide-react';
import { format, parseISO, isPast, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

const STATUS_CONFIG = {
  pendiente:    { label: 'Pendiente',    color: 'text-amber-400',    bg: 'bg-amber-400/10',   ring: 'ring-amber-400/20',   icon: Clock },
  asignada:     { label: 'Asignada',     color: 'text-blue-400',     bg: 'bg-blue-400/10',    ring: 'ring-blue-400/20',    icon: Clock },
  en_progreso:  { label: 'En Progreso',  color: 'text-sky-400',      bg: 'bg-sky-400/10',     ring: 'ring-sky-400/20',     icon: Wrench },
  completada:   { label: 'Completada',   color: 'text-emerald-400',  bg: 'bg-emerald-400/10', ring: 'ring-emerald-400/20', icon: CheckCircle },
  cancelada:    { label: 'Cancelada',    color: 'text-slate-400',    bg: 'bg-slate-400/10',   ring: 'ring-slate-400/20',   icon: AlertCircle },
};

const PRIORITY_CONFIG = {
  baja:    { label: 'Baja',    border: 'border-l-slate-600',  dot: 'bg-slate-500' },
  media:   { label: 'Media',   border: 'border-l-blue-500',   dot: 'bg-blue-500' },
  alta:    { label: 'Alta',    border: 'border-l-amber-500',  dot: 'bg-amber-500' },
  urgente: { label: 'Urgente', border: 'border-l-red-500',    dot: 'bg-red-500' },
};

const TYPE_LABELS = {
  mantenimiento_preventivo: 'Mant. Preventivo',
  mantenimiento_correctivo: 'Mant. Correctivo',
  instalacion: 'Instalación',
  inspeccion: 'Inspección',
  reparacion: 'Reparación',
  emergencia: 'Emergencia',
};

export default function OTOperarioCard({ ot, onOpen }) {
  const cfg = STATUS_CONFIG[ot.status] || STATUS_CONFIG.pendiente;
  const prio = PRIORITY_CONFIG[ot.priority] || PRIORITY_CONFIG.media;
  const StatusIcon = cfg.icon;

  const parsedDate = ot.scheduled_date ? parseISO(ot.scheduled_date) : null;
  const isOverdue = parsedDate && isPast(new Date(parsedDate.getTime() + 86399000)) && ot.status !== 'completada' && ot.status !== 'cancelada';
  const daysLeft = parsedDate ? differenceInDays(parsedDate, new Date()) : null;

  return (
    <button
      onClick={onOpen}
      className={`group w-full text-left bg-slate-900/50 backdrop-blur-sm border border-slate-800 border-l-4 ${prio.border} rounded-xl p-4 hover:bg-slate-800/50 hover:border-slate-700 hover:scale-[1.01] transition-all duration-200 relative overflow-hidden`}
    >
      {/* Glow on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 50% 0%, rgba(59,130,246,0.06), transparent 70%)' }} />

      {/* Header */}
      <div className="relative flex items-start justify-between gap-2 mb-2.5">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.bg} ${cfg.color} ring-1 ${cfg.ring}`}>
          <StatusIcon className="h-2.5 w-2.5" />
          {cfg.label}
        </span>
        <div className="flex items-center gap-1">
          <span className={`h-1.5 w-1.5 rounded-full ${prio.dot}`} />
          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">{prio.label}</span>
        </div>
      </div>

      {/* Title */}
      <h3 className="relative text-sm font-semibold text-white leading-snug mb-2 line-clamp-2 group-hover:text-primary transition-colors">
        {ot.title}
      </h3>

      {/* Location */}
      {ot.location && (
        <div className="relative flex items-center gap-1.5 text-xs text-slate-400 mb-3">
          <MapPin className="h-3 w-3 flex-shrink-0 text-slate-500" />
          <span className="truncate">{ot.location}</span>
        </div>
      )}

      {/* Footer */}
      <div className="relative flex items-center justify-between text-[11px] mt-2 pt-3 border-t border-slate-800/80">
        <span className="text-slate-500 font-medium">{TYPE_LABELS[ot.type] || ot.type?.replace(/_/g, ' ') || '—'}</span>
        {parsedDate && (
          <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-400 font-semibold' : daysLeft !== null && daysLeft <= 1 ? 'text-amber-400 font-medium' : 'text-slate-500'}`}>
            <Calendar className="h-3 w-3" />
            {isOverdue ? 'Vencida' : daysLeft === 0 ? 'Hoy' : daysLeft === 1 ? 'Mañana' : format(parsedDate, 'dd MMM', { locale: es })}
          </span>
        )}
      </div>

      {/* Chevron */}
      <ChevronRight className="absolute top-4 right-3 h-4 w-4 text-slate-700 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all" />
    </button>
  );
}