import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (!user.email) return Response.json({ linked: false, reason: 'no_email' });

    const sb = base44.asServiceRole;

    // Filtrar directamente por email en la query en lugar de traer todos los empleados
    const emailNorm = user.email.toLowerCase().trim();
    const allEmployees = await sb.entities.Employee.filter({ email: user.email }).catch(() => []);

    // Fallback: si el sistema devuelve case-sensitive y no matchea, buscar manualmente
    // pero sólo sobre el conjunto filtrado (ya pequeño)
    let matches = allEmployees.filter(
      emp => emp.email?.toLowerCase().trim() === emailNorm
    );

    // Si no hay match exacto por email, intentar búsqueda amplia solo si el filtro vino vacío
    if (matches.length === 0 && allEmployees.length === 0) {
      // Última instancia: traer todos y filtrar (fallback para sistemas donde el filtro no funciona por case)
      const allFallback = await sb.entities.Employee.list('-created_date', 2000).catch(() => []);
      matches = allFallback.filter(emp => emp.email?.toLowerCase().trim() === emailNorm);
    }

    if (matches.length === 0) return Response.json({ linked: false, reason: 'no_match' });

    // Elegir el empleado a vincular
    let emp;
    if (matches.length > 1) {
      emp = matches.find(e => e.user_id === user.id)
         || matches.find(e => e.status === 'activo')
         || matches[0];
      console.warn(`[vincularEmpleado] Múltiples fichas con email ${user.email}: vinculando a ${emp.full_name} (${emp.id})`);
    } else {
      emp = matches[0];
    }

    const employeeRole = emp.role || null;

    // Actualizar user_id y sincronizar full_name (no bloquea el lookup de permisos)
    const updateTasks = [];
    if (emp.user_id !== user.id) {
      updateTasks.push(sb.entities.Employee.update(emp.id, { user_id: user.id }));
    }
    const isEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const platformNameIsEmail = isEmailPattern.test((user.full_name || '').trim());
    const platformNameDiffers = (user.full_name || '').trim() !== (emp.full_name || '').trim();
    if (emp.full_name && (platformNameIsEmail || platformNameDiffers)) {
      updateTasks.push(base44.auth.updateMe({ full_name: emp.full_name }).catch(err => {
        console.warn(`[vincularEmpleado] No se pudo sincronizar full_name: ${err.message}`);
      }));
    }
    await Promise.allSettled(updateTasks);

    // Lookup de permisos por rol — tolerante a mayúsculas/minúsculas
    let employeePermissions = null;
    if (employeeRole) {
      const roleNorm = employeeRole.toLowerCase().trim();
      let candidates = await sb.entities.RolePermission.filter({ role_name: employeeRole }).catch(() => []);
      if (!candidates || candidates.length === 0) {
        // El filtro por role_name puede ser case-sensitive: listar todo y matchear insensible
        candidates = await sb.entities.RolePermission.list('-created_date', 500).catch(() => []);
      }
      const match = candidates.find(rp => rp.role_name?.toLowerCase().trim() === roleNorm);
      if (match) {
        employeePermissions = match.permissions;
      } else {
        console.warn(`[vincularEmpleado] Rol "${employeeRole}" no tiene RolePermission configurado.`);
      }
    }

    return Response.json({
      linked: true,
      employee_id: emp.id,
      employee_name: emp.full_name,
      employee_role: employeeRole,
      employee_permissions: employeePermissions,
      role_matched: employeePermissions !== null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});