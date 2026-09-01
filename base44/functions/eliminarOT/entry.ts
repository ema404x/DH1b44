import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveOtPermissions, explicitOrLegacy } from "../../shared/otPermissions.ts";

// Elimina una OT de forma robusta, sin depender del RLS directo sobre
// user.data.sector_id (que falla con 403 cuando el sector de plataforma queda
// desfasado). Usa asServiceRole + guard de sector explícito, igual que
// transicionEstadoOT. Espeja la RLS de WorkOrder.delete:
//   - admin: puede borrar OTs de su propio sector
//   - gerente: puede borrar solo OTs del sector 'bapro'
// No agrega lógica especial por sector: el guard de aislamiento bloquea
// cross-sector igual para todos.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { ot_id } = body;
    if (!ot_id) return Response.json({ error: 'Falta ot_id' }, { status: 400 });

    // Permisos canónicos vía Control de Acceso (RolePermission) + ficha de Empleado.
    // Cierra el bypass de platform-role: un jefe_sitio con platformRole='admin' ya
    // no borra OTs del sector salvo que su rol lo permita explícitamente. Conserva
    // el comportamiento legacy exacto (admin siempre; gerente sólo bapro) como
    // fallback cuando RolePermission no define delete. Super-admin puro conserva
    // acceso total.
    const P = await resolveOtPermissions(base44, user);
    if (!P.callerSector && !P.superAdmin) {
      return Response.json({ error: 'Sin sector asignado' }, { status: 403 });
    }

    // Leer la OT via service role (bypass de RLS — el permiso lo controlamos acá)
    // .get() lanza cuando no existe — capturar para devolver 404 limpio.
    let ot = null;
    try {
      ot = await base44.asServiceRole.entities.WorkOrder.get(ot_id);
    } catch (_) { /* not found */ }
    if (!ot) return Response.json({ error: 'Orden de trabajo no encontrada' }, { status: 404 });

    // Aislamiento por sector (salvo super-admin puro sin sector).
    if (!P.superAdmin && ot.sector_id !== P.callerSector) {
      return Response.json({ error: 'Esta OT pertenece a otro sector. Cambiá de sector activo para operarla.' }, { status: 403 });
    }

    // Permiso de borrado: RolePermission.WorkOrder.delete con fallback al legacy
    // (admin + sector | gerente + bapro). Sin bypass por rol de plataforma.
    const empRole = P.employee?.role || '';
    const legacyDelete = empRole === 'admin' || (empRole === 'gerente' && ot.sector_id === 'bapro');
    const canDelete = P.superAdmin || explicitOrLegacy(P.perms, 'delete', legacyDelete);
    if (!canDelete) {
      return Response.json({ error: 'No tenés permiso para eliminar esta OT' }, { status: 403 });
    }

    await base44.asServiceRole.entities.WorkOrder.delete(ot_id);
    return Response.json({ success: true, mensaje: 'OT eliminada correctamente' });
  } catch (error) {
    return Response.json({ error: error.message || 'Error al eliminar la OT' }, { status: 500 });
  }
}