/**
 * REGLA DE ORO — Vencimiento de Órdenes de Trabajo (OT).
 * Fuente única de verdad (cliente), espejo de base44/shared/otVencimiento.ts.
 * Usada por Kanban, Cards, Portal del operario, filtro avanzado de WorkOrders
 * y Dashboard client-side. Aplica a AMBOS sectores (escuela y bapro) de forma
 * idéntica.
 *
 * REGLA:
 *  Una OT está VENCIDA si y sólo si:
 *    1. Está en un estado ACTIVO (no terminal: no completada ni cancelada), Y
 *    2. Tiene fecha programada (scheduled_date), Y
 *    3. La fecha de HOY (calendario, huso Argentina) es POSTERIOR a la fecha
 *       programada.
 *
 *  El deadline es la propia fecha programada. NO se usa fecha_inicio_real ni
 *  dias_vencimiento_ot. Una OT que pasa a en_progreso hoy NO está vencida
 *  aunque su scheduled_date sea hoy; lo estará recién cuando el calendario
 *  supere ese día. Corrige el bug donde toda OT en en_progreso se marcaba
 *  vencida al instante (el reloj caía a scheduled_date, que suele estar en el
 *  pasado).
 *
 *  Fail-safes (sin vacíos ni bugs):
 *   - Sin scheduled_date → false.  - Fecha inválida → false.
 *   - Estados terminales → false.  - scheduled_date == hoy → false.
 *
 *  Timezone: "hoy" se calcula en huso Argentina (UTC-3, sin DST desde 2009),
 *  igual en cliente y backend → flag consistente sin depender del runtime.
 */

export const OT_ACTIVE_STATES = [
  'pendiente',
  'asignada',
  'en_progreso',
  'pendiente_validacion',
  'obra',
];

export const OT_TERMINAL_STATES = ['completada', 'cancelada'];

const AR_OFFSET_MS = -3 * 60 * 60 * 1000; // UTC-3 (Argentina, sin DST)

// Devuelve la fecha calendario de Argentina (YYYY-MM-DD) para un instante dado.
function arDateStr(now) {
  return new Date(now.getTime() + AR_OFFSET_MS).toISOString().split('T')[0];
}

// Normaliza cualquier valor de fecha a 'YYYY-MM-DD' confiable, o null si no
// es parseable.
function toDateStr(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value.toISOString().split('T')[0];
  }
  const s = String(value).trim();
  if (!s) return null;
  const datePart = s.split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

/**
 * Determina si una OT está vencida según la regla de oro.
 * @param {object} ot  registro de WorkOrder (mínimo { status, scheduled_date }).
 * @param {Date}   now instante de referencia (inyectable para tests).
 * @returns {boolean}
 */
export function esOtVencida(ot, now = new Date()) {
  if (!ot) return false;
  const status = ot.status;
  if (!status || OT_TERMINAL_STATES.includes(status)) return false;
  if (!OT_ACTIVE_STATES.includes(status)) return false;
  const scheduled = toDateStr(ot.scheduled_date);
  if (!scheduled) return false; // sin fecha programada → fail-safe
  return arDateStr(now) > scheduled;
}

/**
 * Diferencia en días calendario entre HOY y la fecha programada
 * (positivo = días vencida, 0 = vence hoy, negativo = días restantes).
 * No aplica a estados terminales ni a OTs sin fecha (devuelve null).
 * @param {object} ot
 * @param {Date}   now
 * @returns {number|null}
 */
export function diasVencimientoOt(ot, now = new Date()) {
  if (!ot) return null;
  const status = ot.status;
  if (!status || OT_TERMINAL_STATES.includes(status) || !OT_ACTIVE_STATES.includes(status)) return null;
  const scheduled = toDateStr(ot.scheduled_date);
  if (!scheduled) return null;
  const today = arDateStr(now);
  return Math.round(
    (new Date(today + 'T00:00:00Z').getTime() - new Date(scheduled + 'T00:00:00Z').getTime()) / 86400000
  );
}