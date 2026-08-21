import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { isJefeSitioRole } from "../../shared/roles.ts";

// Devuelve la lista de operarios del sector del caller — la fuente única para
// resolver nombres tipeados → user_id al asignar OTs (WorkOrderDetailPanel).
//
// PROBLEMA QUE RESUELVE
//   El panel usaba Employee.list / User.list del lado del cliente. La RLS deja a
//   un jefe_sitio ver solo SU ficha (Employee.read) y solo SU usuario (User.list
//   es admin-only), así que nunca podía resolver el user_id de otro operario →
//   assigned_to quedaba vacío y la visibilidad dependía solo del match por nombre
//   en getWorkOrdersForUser.
//
// SOLUCIÓN
//   Un único endpoint read-only, service-role (bypass de RLS), sector-scoped:
//   devuelve Employees del sector (con/sin cuenta) + platform Users del sector
//   con rol 'user' sin ficha. El aislamiento queda garantizado por el filtro
//   sector_id = callerSector. Es puramente aditivo — no toca ningún flujo
//   existente.
//
// PERMISO: cualquier usuario autenticado con sector puede llamarlo. Solo devuelve
// operarios de SU propio sector, así que no hay fuga cross-sector.

const norm = (s) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });

    // Sector canónico: la ficha de Empleado es la fuente de verdad (igual que
    // eliminarOT / emitirCertificado). user.data tiene prioridad para no alterar
    // comportamiento; Employee es fallback cuando falta (estado stale).
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

    // Cargar Employees y Users del sector (service role, sin RLS) en paralelo.
    const [emps, users] = await Promise.all([
      base44.asServiceRole.entities.Employee.filter({ sector_id: callerSector }),
      base44.asServiceRole.entities.User.list('-created_date', 200),
    ]);
    const sectorUsers = users.filter(
      (u) => u.role === 'user' && (u.data?.sector_id || u.sector_id) === callerSector
    );

    const operarios = [];
    const seenUserIds = new Set();

    // 1) Employees del sector (con o sin cuenta vinculada).
    for (const e of emps) {
      if (e.user_id) seenUserIds.add(e.user_id);
      operarios.push({
        full_name: e.full_name || '',
        email: (e.email || '').toLowerCase().trim(),
        user_id: e.user_id || '',
        role: e.role || '',
        is_jefe: isJefeSitioRole(e.role),
        has_ficha: true,
        has_account: !!e.user_id,
        status: e.status || 'activo',
      });
    }

    // 2) Users con cuenta pero sin ficha de Employee (alta directa en plataforma).
    for (const u of sectorUsers) {
      if (seenUserIds.has(u.id)) continue;
      operarios.push({
        full_name: u.full_name || '',
        email: (u.email || '').toLowerCase().trim(),
        user_id: u.id,
        role: 'user',
        is_jefe: false,
        has_ficha: false,
        has_account: true,
        status: 'activo',
      });
    }

    return Response.json({
      operarios,
      sector: callerSector,
      total: operarios.length,
      con_cuenta: operarios.filter((o) => o.has_account).length,
      sin_cuenta: operarios.filter((o) => !o.has_account).length,
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}