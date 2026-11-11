// Espejo en servidor de src/lib/fechaLocal.js — mantener ambos iguales.
// Fechas de calendario guardadas sin hora ("YYYY-MM-DD"): new Date() las toma
// como medianoche UTC (21:00 del día anterior en Argentina).
// Cualquier otro valor (fecha con hora, Date) se comporta igual que new Date().

const SOLO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const soloFecha = (v) => (typeof v === 'string' ? SOLO_FECHA.exec(v.trim()) : null);

/** "YYYY-MM-DD" → ese día a las 23:59:59 de Argentina. Para vencimientos. */
export function finDiaLocal(v) {
  const m = soloFecha(v);
  return m ? new Date(`${m[0]}T23:59:59.999-03:00`) : new Date(v);
}