import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { isAdminLevelRole, isFieldRole } from "../../shared/roles.ts";

/**
 * Devuelve las OTs que el usuario actual puede ver.
 * Es la ÚNICA fuente de verdad para visibilidad de OTs — centraliza toda la lógica
 * de filtrado en el backend, sin depender de RLS ni de filtros frontend.
 *
 * Reglas:
 * - Admin / Gerente: ve todas las OTs de su sector.
 * - Jefe de sitio / campo: ve OTs donde es creador, jefe_sitio_email, assigned_to,
 *   o donde su nombre aparece en jefe_sitio / assigned_name.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const userEmail = (user.email || '').toLowerCase().trim();
    const userId = user.id;
    const userSector = user.data?.sector_id || user.sector_id || 'escuela';
    const platformRole = user.role;

    // Resolver empleado vinculado para obtener rol y nombre canónico
    let employee = null;
    if (userEmail) {
      const empResults = await base44.asServiceRole.entities.Employee.filter({ email: userEmail });
      employee = empResults[0] || null;
    }
    if (!employee && userId) {
      const empByUserId = await base44.asServiceRole.entities.Employee.filter({ user_id: userId });
      employee = empByUserId[0] || null;
    }

    const employeeRole = (employee?.role || '').toLowerCase().trim();
    const employeeName = employee?.full_name || user.full_name || '';

    // Verificar permiso admin_view para WorkOrder (configurado en Control de Acceso)
    let hasAdminView = false;
    if (employee?.role) {
      const rolePerms = await base44.asServiceRole.entities.RolePermission.filter({});
      const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const match = rolePerms.find(rp => norm(rp.role_name) === norm(employee.role));
      hasAdminView = match?.permissions?.WorkOrder?.admin_view === true;
    }

    // Roles con visibilidad total dentro del sector (definición centralizada en shared/roles.ts)
    const isAdminLevel = platformRole === 'admin' ||
                         platformRole === 'gerente' ||
                         isAdminLevelRole(employeeRole) ||
                         hasAdminView;
    const isField = isFieldRole(employeeRole);

    // Query WorkOrders via service role (bypassing RLS)
    const allOTs = await base44.asServiceRole.entities.WorkOrder.list('-created_date', 500);

    // Filtro 1: sector (aislamiento entre sectores)
    let result = allOTs.filter(ot => (ot.sector_id || 'escuela') === userSector);

    // Filtro 2: admin/gerente y roles de campo ven todas las OTs de su sector.
    // Modelo basado en ubicación: cualquier operario del sector puede ver y
    // auto-asignarse OTs pendientes/asignadas; las en_progreso las ve pero no puede
    // reiniciarlas (lo bloquea la máquina de estados en transicionEstadoOT).
    // El aislamiento entre sectores ya quedó garantizado en Filtro 1.
    if (isAdminLevel || isField) {
      return Response.json({ orders: result, total: result.length, role: isAdminLevel ? 'admin' : employeeRole });
    }

    // Sin rol de campo ni admin — ver solo lo que creó
    result = result.filter(ot => ot.created_by_id === userId);
    return Response.json({ orders: result, total: result.length, role: 'user' });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}