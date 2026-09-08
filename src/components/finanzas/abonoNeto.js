// Cálculo del monto NETO de un certificado y utilidades de proyección de abonos.
// Fuente única de verdad para no mezclar bruto vs neto entre módulos de finanzas.

/**
 * Monto neto a cobrar de un certificado:
 * subtotal − anticipo − fondo de reparo (si aplica) − % ya pagado anteriormente.
 */
export const netoCertificado = (c) => {
  const subtotal = Number(c?.subtotal) || 0;
  if (!subtotal) return 0;
  const anticipo = subtotal * ((Number(c?.anticipo_pct) || 0) / 100);
  const fondoReparo = c?.fondo_reparo_aplicar
    ? subtotal * ((Number(c?.fondo_reparo_pct) || 0) / 100)
    : 0;
  const pagadoAnt = subtotal * ((Number(c?.porcentaje_pagado_anteriormente) || 0) / 100);
  return Math.max(0, subtotal - anticipo - fondoReparo - pagadoAnt);
};

/** Suma del neto de una lista de certificados. */
export const sumarNeto = (certificados) =>
  (certificados || []).reduce((s, c) => s + netoCertificado(c), 0);

/** Cantidad de meses (inclusivo) entre dos fechas 'YYYY-MM-DD'. */
export const mesesEntre = (inicioStr, finStr) => {
  if (!inicioStr || !finStr) return 0;
  try {
    const i = new Date(Number(inicioStr.slice(0, 4)), Number(inicioStr.slice(5, 7)) - 1, 1);
    const f = new Date(Number(finStr.slice(0, 4)), Number(finStr.slice(5, 7)) - 1, 1);
    return Math.max(0, (f.getFullYear() - i.getFullYear()) * 12 + (f.getMonth() - i.getMonth()) + 1);
  } catch { return 0; }
};

/** Diferencia en meses desde inicioStr hasta hoy (meses transcurridos del contrato). */
export const mesesTranscurridos = (inicioStr) => {
  if (!inicioStr) return 0;
  try {
    const i = new Date(Number(inicioStr.slice(0, 4)), Number(inicioStr.slice(5, 7)) - 1, 1);
    const now = new Date();
    return Math.max(0, (now.getFullYear() - i.getFullYear()) * 12 + (now.getMonth() - i.getMonth()) + 1);
  } catch { return 0; }
};

/** Clave de mes 'YYYY-MM' para una fecha. */
export const mesPeriodoKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** Días restantes hasta una fecha 'YYYY-MM-DD' (negativo si ya pasó). */
export const diasHasta = (fechaStr) => {
  if (!fechaStr) return null;
  try {
    const target = new Date(fechaStr + 'T00:00:00');
    return Math.round((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  } catch { return null; }
};