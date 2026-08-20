import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Backfill de assigned_to en OTs activas que quedaron solo con assigned_name
 // (el jefe tipea el nombre en el panel de detalle, lo que vacía assigned_to).
// Resuelve nombre → user_id del mismo sector buscando en BOTH Employee.user_id
// y platform User.full_name (los operarios suelen tener cuenta de plataforma
// sin ficha de Employee). Estampa assigned_to (y jefe_sitio_email si el
// asignado es jefe). Idempotente: solo toca OTs con assigned_to vacío y
// assigned_name presente. Reporta resueltas vs sin resolver.

const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ');
const isJefeRole = (role) => role && role.toLowerCase().replace(/[\s_]+/g, '').includes('jefe');
const TERMINALES = ['completada', 'cancelada'];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });

    // Sector canónico desde la ficha de Empleado
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

    // Lookup combinado: nombre normalizado → { user_id, email, isJefe }
    // 1) Employees del sector con user_id
    const sectorEmployees = await base44.asServiceRole.entities.Employee.filter({ sector_id: callerSector });
    const lookup = {};
    for (const emp of sectorEmployees) {
      if (emp.full_name && emp.user_id) {
        lookup[normalize(emp.full_name)] = {
          user_id: emp.user_id,
          email: emp.email,
          isJefe: isJefeRole(emp.role),
        };
      }
    }
    // 2) Platform Users del sector (rol 'user' = operarios sin ficha de Employee)
    //    Los operarios suelen tener cuenta de plataforma pero no Employee record.
    const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 200);
    for (const u of allUsers) {
      if (u.role !== 'user') continue;
      const uSector = u.data?.sector_id || u.sector_id;
      if (uSector !== callerSector) continue;
      const key = normalize(u.full_name);
      // No pisar un Employee match (tiene info de role/jefe); solo agregar si no existe
      if (key && u.id && !lookup[key]) {
        lookup[key] = { user_id: u.id, email: u.email, isJefe: false };
      }
    }

    // OTs activas del sector sin assigned_to pero con assigned_name
    const sectorOTs = await base44.asServiceRole.entities.WorkOrder.filter({ sector_id: callerSector }, '-updated_date', 500);
    const pendientes = sectorOTs.filter(ot =>
      !TERMINALES.includes(ot.status) &&
      !ot.assigned_to &&
      ot.assigned_name && ot.assigned_name.trim()
    );

    let resueltas = 0;
    let sinResolver = 0;
    const updates = [];
    const sinResolverDetalle = [];

    for (const ot of pendientes) {
      const match = lookup[normalize(ot.assigned_name)];
      if (match) {
        const patch = { id: ot.id, assigned_to: match.user_id };
        if (match.isJefe && match.email) {
          patch.jefe_sitio_email = match.email.toLowerCase().trim();
        }
        updates.push(patch);
        resueltas++;
      } else {
        sinResolver++;
        sinResolverDetalle.push({ id: ot.id, title: ot.title, assigned_name: ot.assigned_name });
      }
    }

    if (updates.length > 0) {
      await base44.asServiceRole.entities.WorkOrder.bulkUpdate(updates);
    }

    return Response.json({
      success: true,
      sector: callerSector,
      total_pendientes: pendientes.length,
      resueltas,
      sin_resolver: sinResolver,
      sin_resolver_detalle: sinResolverDetalle,
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Error al hacer backfill de assigned_to' }, { status: 500 });
  }
}