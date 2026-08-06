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

    // Filtro 2: admin/gerente ven todas las OTs de su sector.
    if (isAdminLevel) {
      return Response.json({ orders: result, total: result.length, role: 'admin' });
    }

    // Roles de campo: solo las OTs asignadas a ellos (assigned_to === userId),
    // las que crearon, o las que tienen su email como jefe_sitio. NO ven todas
    // las del sector — el descubrimiento de OTs nuevas se hace escaneando el QR
    // de la ubicación (LocationOTListModal → publicFichar.getWorkOrderForLocation),
    // y al iniciar la OT el backend estampa assigned_to = user.id para que pase
    // a estar visible acá.
    if (isField) {
      result = result.filter(ot =>
        (ot.assigned_to && ot.assigned_to === userId) ||
        (ot.created_by_id && ot.created_by_id === userId) ||
        (ot.jefe_sitio_email && ot.jefe_sitio_email.toLowerCase().trim() === userEmail)
      );
      return Response.json({ orders: result, total: result.length, role: employeeRole });
    }

    // Sin rol de campo ni admin — ver solo lo que creó
    result = result.filter(ot => ot.created_by_id === userId);
    return Response.json({ orders: result, total: result.length, role: 'user' });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}