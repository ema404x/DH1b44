// Espejo JS del predicado de visibilidad de OT
// (base44/shared/workOrderVisibility.ts). Se usa en el cliente para filtrar
// eventos realtime (useWorkOrderRealtime) sin ir al backend por cada evento.
// El ctx lo entrega getWorkOrdersForUser en res.data.ctx.

const norm = (s) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

/**
 * Una OT es visible para el caller si pertenece a su sector Y cumple la
 * condición de su rol (admin-view, propia, o linkage jefe para roles de campo).
 * Pure function — idéntica al predicado del backend.
 */
export function otEsVisiblePara(ot, ctx) {
  if (!ot || !ctx) return false;

  // Aislamiento entre sectores + fail-closed: OT sin sector_id → excluida.
  if (!ot.sector_id || ot.sector_id !== ctx.sector) return false;

  // a. Admin-view: todo el sector.
  if (ctx.isAdminView) return true;

  const myName = norm(ctx.employeeName);
  const otName = norm(ot.assigned_name);
  const otJefeName = norm(ot.jefe_sitio);

  // Visibilidad PROPIA: creador, jefe por email, asignado por id/nombre.
  const propia =
    (!!ot.created_by_id && ot.created_by_id === ctx.userId) ||
    (!!ot.jefe_sitio_email &&
      ot.jefe_sitio_email.toLowerCase().trim() === ctx.userEmail) ||
    (!!ot.assigned_to && ot.assigned_to === ctx.userId) ||
    (!!myName && !!otName && otName === myName) ||
    (!!myName && !!otJefeName && otJefeName === myName);
  if (propia) return true;

  // b. Linkage jefe (sólo roles de campo): OTs creadas por su jefe o donde el
  //    jefe es responsable por email/nombre.
  if (ctx.isField && ctx.jefe) {
    return (
      (!!ctx.jefe.userId &&
        !!ot.created_by_id &&
        ot.created_by_id === ctx.jefe.userId) ||
      (!!ctx.jefe.email &&
        !!ot.jefe_sitio_email &&
        ot.jefe_sitio_email.toLowerCase().trim() === ctx.jefe.email) ||
      (!!ctx.jefe.name && !!otJefeName && otJefeName === norm(ctx.jefe.name))
    );
  }

  // c. Sin ficha de campo ni admin-view: sólo propia (ya evaluada → false).
  return false;
}