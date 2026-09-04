/**
 * workOrderActions.js — Lógica de decisión compartida entre el módulo
 * autenticado (PortalOperarioApp) y el portal público (EjecutarOTEnPortal).
 *
 * Single source of truth para:
 *  - canActOn(ot, ctx): ¿puede este operario actuar sobre la OT? → { canAct, reason }
 *  - decideSteps(ot): ¿cuántos pasos exige la OT? → 'one' | 'two'
 *
 * Ambos caminos consumen estas funciones para que la decisión NUNCA diverja
 * entre módulo y portal. Si una regla cambia, se cambia acá y ambos la heredan.
 */

const normName = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

/**
 * ¿La OT tiene checklist con ítems pendientes o requiere fotos?
 * Si sí, exige 2 pasos (Iniciar → Finalizar y Reportar), igual que el módulo.
 * Si no, permite 1 paso (reportar directo a pendiente_validacion).
 */
export function decideSteps(ot) {
  const checklist = ot?.checklist || [];
  const hasPendingTasks = checklist.some((t) => !t.completed);
  const requiresPhotos = !!ot?.require_photos;
  return hasPendingTasks || requiresPhotos ? 'two' : 'one';
}

/**
 * ¿Puede el operario actual actuar sobre esta OT?
 *
 * ctx = { userId, displayName, operarioSesion }
 *  - Módulo: pasa userId (currentUser.id) + displayName.
 *  - Portal: pasa operarioSesion (nombre manuscrito cacheado en sesión).
 *
 * Devuelve { canAct: boolean, reason?: string }.
 */
export function canActOn(ot, ctx = {}) {
  if (!ot) return { canAct: false, reason: 'OT no disponible' };

  const status = ot.status;

  if (status === 'pendiente' || status === 'asignada') {
    // Cualquier operario puede iniciar — la asignación del jefe es sugerencia.
    return { canAct: true };
  }

  if (status === 'en_progreso') {
    // Solo el operario que está trabajando la OT puede reportarla/cerrarla.
    const isOwner = isOwnerOf(ot, ctx);
    if (!isOwner) {
      const who = ot.assigned_name || ot.operario_sesion || 'otro operario';
      return { canAct: false, reason: `La trabaja ${who}` };
    }
    return { canAct: true };
  }

  if (status === 'pendiente_validacion') {
    return { canAct: false, reason: 'En validación' };
  }

  if (status === 'completada' || status === 'cancelada') {
    return { canAct: false, reason: status === 'completada' ? 'Completada' : 'Cancelada' };
  }

  return { canAct: false, reason: status || 'No disponible' };
}

/**
 * ¿El operario actual es el dueño de la OT en progreso?
 * Doble check: por user_id (módulo) o por operario_sesion (portal).
 */
export function isOwnerOf(ot, ctx = {}) {
  // Módulo autenticado: match por user_id o nombre normalizado.
  if (ctx.userId && ot.assigned_to === ctx.userId) return true;
  if (ctx.displayName && ot.assigned_name && normName(ot.assigned_name) === normName(ctx.displayName)) {
    return true;
  }
  // Portal: match por operario_sesion (nombre manuscrito).
  if (ctx.operarioSesion && ot.operario_sesion && normName(ot.operario_sesion) === normName(ctx.operarioSesion)) {
    return true;
  }
  // Si la OT no tiene dueño estampado (legacy sin assigned_to ni operario_sesion),
  // permitir — fail-open solo para OTs sin dueño, no para mismatch.
  if (!ot.assigned_to && !ot.assigned_name && !ot.operario_sesion) return true;
  return false;
}