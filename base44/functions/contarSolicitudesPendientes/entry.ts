import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Arranque rápido: devuelve SOLO la cantidad de solicitudes de certificado
// esperando aprobación (estado 'enviada' o 'en_revision') para la insignia del
// menú. Sector, permisos y filtro de propias son los mismos de
// gestionarSolicitudesCert (operation 'list'), que no se modifica.

const ADMIN_EMPLOYEE_ROLES = ['gerente', 'gerencia', 'admin', 'administrativo'];
const ESTADOS_PENDIENTES = ['enviada', 'en_revision'];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const sb = base44.asServiceRole;

    // Mismo criterio de sector que gestionarSolicitudesCert: user.data primero,
    // ficha de Empleado solo si falta. Sin sector → 403.
    const userEmail = (user.email || '').toLowerCase().trim();
    let employeeFallback = null;
    if (!user.data?.sector_id) {
      if (userEmail) {
        const empResults = await sb.entities.Employee.filter({ email: userEmail });
        employeeFallback = empResults[0] || null;
      }
      if (!employeeFallback && user.id) {
        const empByUserId = await sb.entities.Employee.filter({ user_id: user.id });
        employeeFallback = empByUserId[0] || null;
      }
    }
    const callerSector = user.data?.sector_id || employeeFallback?.sector_id || user.sector_id;
    if (!callerSector) {
      return Response.json({ error: 'Sin sector asignado' }, { status: 403 });
    }

    let isAdmin = user.role === 'admin';
    if (!isAdmin) {
      const employees = await sb.entities.Employee.filter({ user_id: user.id });
      const emp = employees[0];
      if (emp && ADMIN_EMPLOYEE_ROLES.includes(emp.role?.toLowerCase())) isAdmin = true;
    }

    const enEspera = await sb.entities.SolicitudCertificado.filter({
      sector_id: callerSector,
      estado: { $in: ESTADOS_PENDIENTES },
    });
    // Defensa: se vuelve a filtrar por estado por si el filtro no se aplicó.
    const pendientes = enEspera.filter((s) => ESTADOS_PENDIENTES.includes(s.estado));

    const propias = isAdmin
      ? pendientes
      : pendientes.filter((s) =>
          s.created_by_id === user.id ||
          s.jefe_sitio_email === user.email ||
          s.aprobado_por_email === user.email
        );

    return Response.json({ pendientes: propias.length, isAdmin });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}