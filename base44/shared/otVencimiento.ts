/**
 * REGLA DE ORO — Vencimiento de Órdenes de Trabajo (OT).
 * Fuente única de verdad, usada por Kanban, Cards, Portal del operario,
 * filtro avanzado de WorkOrders, Dashboard client-side, checkAlertas y
 * getDashboardMetrics. Aplica a AMBOS sectores (escuela y bapro) de forma
 * idéntica.
 *
 * REGLA:
 *  Una OT está VENCIDA si y sólo si:
 *    1. Está en un estado ACTIVO (no terminal: no completada ni cancelada), Y
 *    2. Tiene fecha programada (scheduled_date), Y
 *    3. La fecha de HOY (calendario, huso Argentina) es POSTERIOR a la fecha
 *       programada.
 *
 *  Es decir: el deadline es la propia fecha programada. NO se usa
 *  fecha_inicio_real ni dias_vencimiento_ot — la fecha programada ES el
 *  vencimiento. Una OT que pasa a en_progreso hoy NO está vencida aunque su
 *  scheduled_date sea hoy; lo estará recién cuando el calendario supere ese
 *  día. Esto corrige el bug donde toda OT en en_progreso se marcaba vencida
 *  al instante (porque el reloj caía a scheduled_date, que suele estar en el
 *  pasado).
 *
 *  Fail-safes (sin vacíos ni bugs):
 *   - Sin scheduled_date → false (no se puede determinar deadline).
 *   - scheduled_date inválida → false.
 *   - Estados terminales → false (ya resuelta, no tiene sentido vencerla).
 *   - scheduled_date == hoy → false (aún no se superó el día programado).
 *
 *  Timezone: la "fecha de hoy" se calcula en huso Argentina (UTC-3, sin DST
 *  desde 2009), tanto en el cliente (navegador) como en el backend (Deno,
 *  que corre en UTC) — así el flag de vencimiento es consistente y no
 *  depende del huso del runtime.
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
function arDateStr(now: Date): string {
  return new Date(now.getTime() + AR_OFFSET_MS).toISOString().split('T')[0];
}

// Normaliza cualquier valor de fecha (string 'YYYY-MM-DD', ISO completo, o Date)
// a un string 'YYYY-MM-DD' confiable. Devuelve null si no es parseable.
function toDateStr(value: unknown): string | null {
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

export interface WorkOrderLike {
  status?: string | null;
  scheduled_date?: string | null;
}

/**
 * Determina si una OT está vencida según la regla de oro.
 * @param ot  registro de WorkOrder (mínimo { status, scheduled_date }).
 * @param now instante de referencia (inyectable para tests); por defecto ahora.
 */
export function esOtVencida(ot: WorkOrderLike | null | undefined, now: Date = new Date()): boolean {
  if (!ot) return false;
  const status = ot.status;
  if (!status || OT_TERMINAL_STATES.includes(status)) return false;
  if (!OT_ACTIVE_STATES.includes(status)) return false;
  const scheduled = toDateStr(ot.scheduled_date);
  if (!scheduled) return false; // sin fecha programada → fail-safe
  return arDateStr(now) > scheduled;
}

/**
 * Devuelve la diferencia en días calendario entre HOY y la fecha programada
 * (positivo = días vencida, 0 = vence hoy, negativo = días restantes).
 * Útil para badges "Vence hoy / Mañana / Vencida hace N días".
 * No aplica a estados terminales ni a OTs sin fecha programada (devuelve null).
 */
export function diasVencimientoOt(ot: WorkOrderLike | null | undefined, now: Date = new Date()): number | null {
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