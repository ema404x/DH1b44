import { MapPin, LogOut, Timer, UserX, MapPinOff, ClipboardCheck } from 'lucide-react';

const omitida = (f) => f.salida_omitida || f.estado === 'salida_omitida';

// Mismas reglas que usa el servidor para los contadores de la pestaña Hoy.
export const FILTROS_HOY = [
  { key: 'enLugar', label: 'En el lugar ahora', icon: MapPin, tone: 'text-primary bg-primary/15', fn: (f) => f.estado === 'abierta' },
  { key: 'seFueron', label: 'Ya se fueron', icon: LogOut, tone: 'text-emerald-400 bg-emerald-500/15', fn: (f) => Boolean(f.salida_timestamp) && !omitida(f) },
  { key: 'tarde', label: 'Llegaron tarde', icon: Timer, tone: 'text-amber-400 bg-amber-500/15', fn: (f) => f.tarde, horario: true },
  { key: 'noVinieron', label: 'No vinieron', icon: UserX, tone: 'text-red-400 bg-red-500/15', horario: true },
  { key: 'fueraRadio', label: 'Fuera del radio', icon: MapPinOff, tone: 'text-orange-400 bg-orange-500/15', fn: (f) => f.far },
  { key: 'paraRevisar', label: 'Para revisar', icon: ClipboardCheck, tone: 'text-violet-400 bg-violet-500/15', fn: (f) => ['pendiente', 'incidencia'].includes(f.estado_admin) || omitida(f) },
];

export const filtroPorKey = (key) => FILTROS_HOY.find((f) => f.key === key) || FILTROS_HOY[0];