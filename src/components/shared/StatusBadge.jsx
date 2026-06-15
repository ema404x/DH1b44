import React from 'react';
import { cn } from '@/lib/utils';

// Status definitions: bg, text, dot color
const statusConfig = {
  pendiente:   { bg: 'bg-amber-500/10',   text: 'text-amber-400',   dot: 'bg-amber-400',   label: 'Pendiente' },
  en_progreso: { bg: 'bg-blue-500/10',    text: 'text-blue-400',    dot: 'bg-blue-400',    label: 'En Progreso' },
  asignada:    { bg: 'bg-indigo-500/10',  text: 'text-indigo-400',  dot: 'bg-indigo-400',  label: 'Asignada' },
  en_espera:   { bg: 'bg-yellow-500/10',  text: 'text-yellow-400',  dot: 'bg-yellow-400',  label: 'En Espera' },
  completado:  { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400', label: 'Completado' },
  completada:  { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400', label: 'Completada' },
  cancelado:   { bg: 'bg-red-500/10',     text: 'text-red-400',     dot: 'bg-red-400',     label: 'Cancelado' },
  cancelada:   { bg: 'bg-red-500/10',     text: 'text-red-400',     dot: 'bg-red-400',     label: 'Cancelada' },
  pausado:     { bg: 'bg-slate-500/10',   text: 'text-slate-400',   dot: 'bg-slate-400',   label: 'Pausado' },
  activo:      { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400', label: 'Activo' },
  inactivo:    { bg: 'bg-slate-500/10',   text: 'text-slate-400',   dot: 'bg-slate-400',   label: 'Inactivo' },
  borrador:    { bg: 'bg-slate-500/10',   text: 'text-slate-400',   dot: 'bg-slate-400',   label: 'Borrador' },
  enviado:     { bg: 'bg-blue-500/10',    text: 'text-blue-400',    dot: 'bg-blue-400',    label: 'Enviado' },
  emitido:     { bg: 'bg-cyan-500/10',    text: 'text-cyan-400',    dot: 'bg-cyan-400',    label: 'Emitido' },
  aprobado:    { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400', label: 'Aprobado' },
  rechazado:   { bg: 'bg-red-500/10',     text: 'text-red-400',     dot: 'bg-red-400',     label: 'Rechazado' },
  vencido:     { bg: 'bg-orange-500/10',  text: 'text-orange-400',  dot: 'bg-orange-400',  label: 'Vencido' },
  pagada:      { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400', label: 'Pagada' },
  vencida:     { bg: 'bg-red-500/10',     text: 'text-red-400',     dot: 'bg-red-400',     label: 'Vencida' },
  licencia:    { bg: 'bg-purple-500/10',  text: 'text-purple-400',  dot: 'bg-purple-400',  label: 'Licencia' },
  vacaciones:  { bg: 'bg-cyan-500/10',    text: 'text-cyan-400',    dot: 'bg-cyan-400',    label: 'Vacaciones' },
  en_revision: { bg: 'bg-violet-500/10',  text: 'text-violet-400',  dot: 'bg-violet-400',  label: 'En Revisión' },
  enviada:     { bg: 'bg-blue-500/10',    text: 'text-blue-400',    dot: 'bg-blue-400',    label: 'Enviada' },
  aprobada:    { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400', label: 'Aprobada' },
  rechazada:   { bg: 'bg-red-500/10',     text: 'text-red-400',     dot: 'bg-red-400',     label: 'Rechazada' },
};

const priorityConfig = {
  baja:    { bg: 'bg-slate-500/10',  text: 'text-slate-400',  dot: 'bg-slate-400',  label: 'Baja' },
  media:   { bg: 'bg-blue-500/10',   text: 'text-blue-400',   dot: 'bg-blue-400',   label: 'Media' },
  alta:    { bg: 'bg-orange-500/10', text: 'text-orange-400', dot: 'bg-orange-400', label: 'Alta' },
  urgente: { bg: 'bg-red-500/10',    text: 'text-red-400',    dot: 'bg-red-400',    label: 'Urgente' },
};

export default function StatusBadge({ value, type = 'status', dot = true }) {
  const config = type === 'priority' ? priorityConfig : statusConfig;
  const style = config[value];

  if (!style) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400">
        {value}
      </span>
    );
  }

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
      style.bg,
      style.text
    )}>
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', style.dot)} />}
      {style.label}
    </span>
  );
}