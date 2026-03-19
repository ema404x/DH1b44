import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const statusStyles = {
  pendiente: 'bg-amber-100 text-amber-800 border-amber-200',
  en_progreso: 'bg-blue-100 text-blue-800 border-blue-200',
  asignada: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  en_espera: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  completado: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  completada: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  cancelado: 'bg-red-100 text-red-800 border-red-200',
  cancelada: 'bg-red-100 text-red-800 border-red-200',
  pausado: 'bg-gray-100 text-gray-800 border-gray-200',
  activo: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  inactivo: 'bg-gray-100 text-gray-800 border-gray-200',
  borrador: 'bg-gray-100 text-gray-800 border-gray-200',
  enviado: 'bg-blue-100 text-blue-800 border-blue-200',
  aprobado: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  rechazado: 'bg-red-100 text-red-800 border-red-200',
  vencido: 'bg-orange-100 text-orange-800 border-orange-200',
  pagada: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  vencida: 'bg-red-100 text-red-800 border-red-200',
  licencia: 'bg-purple-100 text-purple-800 border-purple-200',
  vacaciones: 'bg-cyan-100 text-cyan-800 border-cyan-200',
};

const priorityStyles = {
  baja: 'bg-slate-100 text-slate-700 border-slate-200',
  media: 'bg-blue-100 text-blue-700 border-blue-200',
  alta: 'bg-orange-100 text-orange-700 border-orange-200',
  urgente: 'bg-red-100 text-red-700 border-red-200',
};

const labels = {
  pendiente: 'Pendiente', en_progreso: 'En Progreso', asignada: 'Asignada',
  en_espera: 'En Espera', completado: 'Completado', completada: 'Completada',
  cancelado: 'Cancelado', cancelada: 'Cancelada', pausado: 'Pausado',
  activo: 'Activo', inactivo: 'Inactivo', borrador: 'Borrador',
  enviado: 'Enviado', aprobado: 'Aprobado', rechazado: 'Rechazado',
  vencido: 'Vencido', pagada: 'Pagada', vencida: 'Vencida',
  licencia: 'Licencia', vacaciones: 'Vacaciones',
  baja: 'Baja', media: 'Media', alta: 'Alta', urgente: 'Urgente',
};

export default function StatusBadge({ value, type = 'status' }) {
  const styles = type === 'priority' ? priorityStyles : statusStyles;
  return (
    <Badge variant="outline" className={cn('text-xs font-medium border', styles[value] || 'bg-gray-100 text-gray-700')}>
      {labels[value] || value}
    </Badge>
  );
}