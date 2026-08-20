import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

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

    // Sector canónico: la ficha de Empleado es la fuente de verdad. Si el
    // usuario de plataforma quedó con data.sector_id stale, usar el sector de
    // la ficha evita el 403 espurio del SDK directo.
    const userEmail = (user.email || '').toLowerCase().trim();
    let employee = null;
    if (userEmail) {
      const empResults = await base44.asServiceRole.entities.Employee.filter({ email: userEmail });
      employee = empResults[0] || null;
    }
    if (!employee && user.id) {
      const empByUserId = await base44.asServiceRole.entities.Employee.filter({ user_id: user.id });
      employee = empByUserId[0] || null;
    }
    const callerSector = employee?.sector_id || user.data?.sector_id || user.sector_id;
    if (!callerSector) {
      return Response.json({ error: 'Sin sector asignado' }, { status: 403 });
    }

    // Leer la OT via service role (bypass de RLS — el permiso lo controlamos acá)
    // .get() lanza cuando no existe — capturar para devolver 404 limpio.
    let ot = null;
    try {
      ot = await base44.asServiceRole.entities.WorkOrder.get(ot_id);
    } catch (_) { /* not found */ }
    if (!ot) return Response.json({ error: 'Orden de trabajo no encontrada' }, { status: 404 });

    // Aislamiento por sector: la OT debe ser del mismo sector del caller.
    if (ot.sector_id !== callerSector) {
      return Response.json({ error: 'Esta OT pertenece a otro sector. Cambiá de sector activo para operarla.' }, { status: 403 });
    }

    // Permiso de borrado — espeja la RLS de WorkOrder.delete:
    //   admin + sector  |  gerente + sector 'bapro'
    const role = user.role || '';
    const canDelete = role === 'admin' || (role === 'gerente' && ot.sector_id === 'bapro');
    if (!canDelete) {
      return Response.json({ error: 'No tenés permiso para eliminar esta OT' }, { status: 403 });
    }

    await base44.asServiceRole.entities.WorkOrder.delete(ot_id);
    return Response.json({ success: true, mensaje: 'OT eliminada correctamente' });
  } catch (error) {
    return Response.json({ error: error.message || 'Error al eliminar la OT' }, { status: 500 });
  }
}