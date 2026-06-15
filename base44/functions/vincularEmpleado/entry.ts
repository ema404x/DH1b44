import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.email) {
      return Response.json({ linked: false, reason: 'no_email' });
    }

    // Buscar ficha de empleado por email (case-insensitive)
    const allEmployees = await base44.asServiceRole.entities.Employee.filter({});
    const matches = allEmployees.filter(
      emp => emp.email?.toLowerCase().trim() === user.email.toLowerCase().trim()
    );

    if (matches.length === 0) {
      return Response.json({ linked: false, reason: 'no_match' });
    }

    // Si hay múltiples empleados con el mismo email, usar al que ya está vinculado o al más reciente activo
    let emp;
    if (matches.length > 1) {
      const alreadyLinked = matches.find(e => e.user_id === user.id);
      if (alreadyLinked) {
        emp = alreadyLinked;
      } else {
        const activeEmployees = matches.filter(e => e.status === 'activo');
        emp = activeEmployees.length > 0 ? activeEmployees[0] : matches[0];
      }
      console.warn(`[vincularEmpleado] Múltiples fichas con email ${user.email}: vinculando a ${emp.full_name} (${emp.id})`);
    } else {
      emp = matches[0];
    }

    // Vincular user_id si aún no está
    if (emp.user_id !== user.id) {
      await base44.asServiceRole.entities.Employee.update(emp.id, { user_id: user.id });
    }

    // ── VALIDACIÓN CRÍTICA: sincronizar full_name de plataforma con nombre real del empleado ──
    // Si el full_name en la plataforma es un email o difiere del nombre en la ficha,
    // lo actualizamos para que todo el sistema use siempre el nombre real.
    const isEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const platformNameIsEmail = isEmailPattern.test((user.full_name || '').trim());
    const platformNameDiffers = (user.full_name || '').trim() !== (emp.full_name || '').trim();

    if (emp.full_name && (platformNameIsEmail || platformNameDiffers)) {
      try {
        await base44.auth.updateMe({ full_name: emp.full_name });
        console.info(`[vincularEmpleado] full_name actualizado: "${user.full_name}" → "${emp.full_name}"`);
      } catch (syncErr) {
        // No bloquear el flujo si falla la sincronización
        console.warn(`[vincularEmpleado] No se pudo sincronizar full_name: ${syncErr.message}`);
      }
    }

    // Buscar permisos del rol (case-insensitive para evitar errores de mayúsculas)
    let employeePermissions = null;
    const employeeRole = emp.role || null;

    if (employeeRole) {
      const allRolePerms = await base44.asServiceRole.entities.RolePermission.filter({});
      const match = allRolePerms.find(
        rp => rp.role_name?.toLowerCase().trim() === employeeRole.toLowerCase().trim()
      );

      if (match) {
        employeePermissions = match.permissions;
      } else {
        // Loguear para diagnóstico: qué roles existen vs qué tiene el empleado
        const existingRoles = allRolePerms.map(rp => rp.role_name);
        console.warn(
          `[vincularEmpleado] Empleado "${emp.full_name}" tiene rol "${employeeRole}" ` +
          `pero no existe un RolePermission con ese nombre. ` +
          `Roles existentes: ${existingRoles.join(', ')}`
        );
      }
    }

    return Response.json({
      linked: true,
      employee_id: emp.id,
      employee_name: emp.full_name,
      employee_role: employeeRole,
      employee_permissions: employeePermissions,
      role_matched: employeePermissions !== null
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});