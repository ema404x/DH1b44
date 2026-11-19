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

export const tienePorDia = (h: any) =>
  Boolean(h?.horarios_por_dia && typeof h.horarios_por_dia === 'object' && Object.keys(h.horarios_por_dia).length);

// Horario de una fecha: usa horarios_por_dia si existe; si no, el horario único de siempre.
export function horarioDelDia(h: any, fecha: string) {
  const dia = diaDe(fecha);
  if (tienePorDia(h)) {
    const d = h.horarios_por_dia[dia] || {};
    const entrada = hm(d.hora_entrada);
    return { laborable: d.laborable === true && entrada != null, entrada, salida: hm(d.hora_salida), hora_entrada: d.hora_entrada || null, hora_salida: d.hora_salida || null };
  }
  return { laborable: (h.dias_laborales || []).includes(dia), entrada: hm(h.hora_entrada), salida: hm(h.hora_salida), hora_entrada: h.hora_entrada, hora_salida: h.hora_salida };
}

// Minuto del día a partir del cual una entrada cuenta como tarde (según el día).
export const limiteEntrada = (h: any, fecha: string) => (horarioDelDia(h, fecha).entrada as number) + (Number(h.tolerancia_minutos) || 0);

export const esLaboral = (h: any, fecha: string) => horarioDelDia(h, fecha).laborable;

// Lunes de la semana de la fecha.
export function lunesDe(fecha: string) {
  const idx = DIAS.indexOf(diaDe(fecha));
  return sumarDias(fecha, -((idx + 6) % 7));
}