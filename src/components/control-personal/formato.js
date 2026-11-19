const TZ = 'America/Argentina/Buenos_Aires';
const fHora = new Intl.DateTimeFormat('es-AR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const fFecha = new Intl.DateTimeFormat('es-AR', { timeZone: TZ, weekday: 'short', day: '2-digit', month: '2-digit' });
const fLarga = new Intl.DateTimeFormat('es-AR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
const fMes = new Intl.DateTimeFormat('es-AR', { timeZone: 'UTC', month: 'long', year: 'numeric' });

export const horaAR = (iso) => (iso ? fHora.format(new Date(iso)) : '—');
export const fechaAR = (iso) => (iso ? fFecha.format(new Date(iso)) : '—');
export const fechaLarga = (ymd) => fLarga.format(new Date(`${ymd}T12:00:00-03:00`));
export const fechaCorta = (ymd) => fFecha.format(new Date(`${ymd}T12:00:00-03:00`));
export const mesTexto = (ym) => fMes.format(new Date(`${ym}-15T12:00:00Z`));

export function horasTexto(minutos) {
  const m = Math.max(0, Math.round(minutos || 0));
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

export function duracion(entrada, salida) {
  if (!entrada || !salida) return null;
  const min = (new Date(salida) - new Date(entrada)) / 60000;
  return min >= 0 ? horasTexto(min) : null;
}

export const normTexto = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

export const ESTADO_FICHA = {
  activo: { label: 'Activo', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  licencia: { label: 'Licencia', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  vacaciones: { label: 'Vacaciones', cls: 'bg-sky-500/15 text-sky-400 border-sky-500/30' },
  inactivo: { label: 'Inactivo', cls: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
};