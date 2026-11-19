// Fechas y horas en Argentina (UTC-3 fijo, sin horario de verano).
const OFF = 3 * 3600000;
export const DIAS = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];

export function arInfo(d: any) {
  const t = new Date(d).getTime();
  if (!Number.isFinite(t)) return null;
  const s = new Date(t - OFF);
  return {
    fecha: s.toISOString().slice(0, 10),
    minutos: s.getUTCHours() * 60 + s.getUTCMinutes(),
    dia: DIAS[s.getUTCDay()],
  };
}

export const inicioDia = (fecha: string) => new Date(`${fecha}T00:00:00-03:00`).toISOString();

export function sumarDias(fecha: string, n: number) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const diaDe = (fecha: string) => DIAS[new Date(`${fecha}T12:00:00Z`).getUTCDay()];

export function hm(s: any): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

// Minuto del día a partir del cual una entrada cuenta como tarde.
export const limiteEntrada = (h: any) => (hm(h.hora_entrada) as number) + (Number(h.tolerancia_minutos) || 0);

export const esLaboral = (h: any, fecha: string) => (h.dias_laborales || []).includes(diaDe(fecha));

// Lunes de la semana de la fecha.
export function lunesDe(fecha: string) {
  const idx = DIAS.indexOf(diaDe(fecha));
  return sumarDias(fecha, -((idx + 6) % 7));
}