// Fechas de calendario guardadas sin hora ("YYYY-MM-DD").
// new Date("YYYY-MM-DD") las toma como medianoche UTC, que en Argentina es
// las 21:00 del día anterior. Estas funciones las interpretan como día local.
// Cualquier otro valor (fecha con hora, Date) se comporta igual que new Date().
// Espejo en servidor: base44/shared/fechaLocal.ts

const SOLO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const soloFecha = (v) => (typeof v === 'string' ? SOLO_FECHA.exec(v.trim()) : null);

/** "YYYY-MM-DD" → ese día a las 00:00 locales. Para mostrar fechas. */
export function parseFechaLocal(v) {
  const m = soloFecha(v);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(v);
}

/** "YYYY-MM-DD" → ese día a las 23:59:59 de Argentina. Para vencimientos. */
export function finDiaLocal(v) {
  const m = soloFecha(v);
  return m ? new Date(`${m[0]}T23:59:59.999-03:00`) : new Date(v);
}

/** Vencida recién cuando terminó el día límite en Argentina. */
export const fechaVencida = (v, ahora = new Date()) => Boolean(v) && finDiaLocal(v) < ahora;

/** Días hasta el vencimiento: 0 = vence hoy, negativo = vencida. */
export const diasParaVencer = (v, ahora = new Date()) =>
  Math.floor((finDiaLocal(v) - ahora) / 86400000);