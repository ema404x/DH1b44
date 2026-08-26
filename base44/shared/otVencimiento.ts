/**
 * REGLA DE ORO — Vencimiento de Órdenes de Trabajo (OT).
 * Fuente única de verdad, usada por Kanban, Cards, Portal del operario,
 * filtro avanzado de WorkOrders, Dashboard client-side, checkAlertas y
 * getDashboardMetrics. Aplica a AMBOS sectores (escuela y bapro) de forma
 * idéntica.
 *
 * REGLA:
 *  Una OT está VENCIDA si y sólo si:
 *    1. Está en estado en_progreso (ejecución activa), Y
 *    2. Tiene fecha programada (scheduled_date), Y
 *    3. La fecha de HOY (calendario, huso Argentina) es POSTERIOR a la fecha
 *       programada.
 *
 *  El deadline es la propia fecha programada. NO se usa fecha_inicio_real ni
 *  dias_vencimiento_ot. Pendiente, asignada, obra y pendiente_validación NUNCA
 *  se marcan vencidas — no tienen ejecución en curso que retrasar. Sólo la OT
 *  que está siendo ejecutada (en_progreso) puede superar su fecha programada.
 *
 *  Esto corrige DOS bugs a la vez:
 *   - Bug viejo: toda OT en en_progreso se marcaba vencida al instante (el reloj
 *     caía a scheduled_date, que suele estar en el pasado, + umbral de N días).
 *   - Bug de la versión anterior: se amplió el vencimiento a pendiente/asignada/
 *     obra, marcando vencidas OTs que no están en ejecución.
 *
 *  Fail-safes (sin vacíos ni bugs):
 *   - Estado distinto de en_progreso → false.
 *   - Sin scheduled_date → false.  - Fecha inválida → false.
 *   - scheduled_date == hoy → false (aún no se superó el día programado).
 *
 *  Timezone: la "fecha de hoy" se calcula en huso Argentina (UTC-3, sin DST
 *  desde 2009), tanto en cliente como en backend → flag consistente.
 */

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
 * Sólo aplica a OTs en en_progreso; el resto nunca se considera vencida.
 * @param ot  registro de WorkOrder (mínimo { status, scheduled_date }).
 * @param now instante de referencia (inyectable para tests); por defecto ahora.
 */
export function esOtVencida(ot: WorkOrderLike | null | undefined, now: Date = new Date()): boolean {
  if (!ot) return false;
  if (ot.status !== 'en_progreso') return false; // sólo la ejecución activa puede vencer
  const scheduled = toDateStr(ot.scheduled_date);
  if (!scheduled) return false; // sin fecha programada → fail-safe
  return arDateStr(now) > scheduled;
}

/**
 * Diferencia en días calendario entre HOY y la fecha programada de una OT en
 * en_progreso (positivo = días vencida, 0 = vence hoy, negativo = días restantes).
 * Para cualquier otro estado (o sin fecha) devuelve null. Útil para badges
 * "Vence hoy / Mañana / Vencida hace N días" en el portal del operario.
 * @param ot
 * @param now
 */
export function diasVencimientoOt(ot: WorkOrderLike | null | undefined, now: Date = new Date()): number | null {
  if (!ot) return null;
  if (ot.status !== 'en_progreso') return null; // sólo la ejecución activa puede vencer
  const scheduled = toDateStr(ot.scheduled_date);
  if (!scheduled) return null;
  const today = arDateStr(now);
  return Math.round(
    (new Date(today + 'T00:00:00Z').getTime() - new Date(scheduled + 'T00:00:00Z').getTime()) / 86400000
  );
}