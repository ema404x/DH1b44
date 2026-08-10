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

    // Query WorkOrders via service role (bypassing RLS).
    // Orden por -updated_date (no -created_date): cuando un operario inicia una OT
    // vieja encontrada por QR, la actualización (status→en_progreso, assigned_to=user.id)
    // bumpa updated_date → la OT burbujea al top-500 y queda visible en "En Progreso".
    // Con -created_date la OT vieja queda fuera del top-500 y "se sale todo" al iniciar.
    const allOTs = await base44.asServiceRole.entities.WorkOrder.list('-updated_date', 500);

    // Filtro 1: sector (aislamiento entre sectores)
    let result = allOTs.filter(ot => (ot.sector_id || 'escuela') === userSector);

    // Filtro 2: admin/gerente ven todas las OTs de su sector.
    if (isAdminLevel) {
      return Response.json({ orders: result, total: result.length, role: 'admin' });
    }

    // Roles de campo: solo las OTs asignadas a ellos, las que crearon, o las que
    // tienen su email como jefe_sitio. NO ven todas las del sector — el descubrimiento
    // de OTs nuevas se hace escaneando el QR de la ubicación (LocationOTListModal →
    // publicFichar.getWorkOrderForLocation), y al iniciar la OT el backend estampa
    // assigned_to = user.id para que pase a estar visible acá.
    //
    // ADEMÁS match por nombre: el jefe suele asignar la OT tipeando el nombre del
    // operario en el panel de detalle (WorkOrderDetailPanel), lo que setea
    // assigned_name pero VACÍA assigned_to. Sin este match por nombre, el operario
    // no vería esas OTs en su lista proactivamente (solo las encontraría escaneando
    // el QR). Comparamos con normalización (lowercase, sin acentos) para tolerar
    // diferencias de mayúsculas/acentos entre el nombre del Employee y lo que tipeó
    // el jefe.
    if (isField) {
      const normName = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const myName = normName(employeeName);
      result = result.filter(ot =>
        (ot.assigned_to && ot.assigned_to === userId) ||
        (ot.created_by_id && ot.created_by_id === userId) ||
        (ot.jefe_sitio_email && ot.jefe_sitio_email.toLowerCase().trim() === userEmail) ||
        (myName && normName(ot.assigned_name) === myName)
      );
      return Response.json({ orders: result, total: result.length, role: employeeRole });
    }

    // Sin rol de campo ni admin — ver las que creó o las que le asignaron
    // (mismo match por nombre por la misma razón: assigned_to suele quedar vacío).
    {
      const normName = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const myName = normName(employeeName);
      result = result.filter(ot =>
        ot.created_by_id === userId ||
        (ot.assigned_to && ot.assigned_to === userId) ||
        (myName && normName(ot.assigned_name) === myName)
      );
      return Response.json({ orders: result, total: result.length, role: 'user' });
    }
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}