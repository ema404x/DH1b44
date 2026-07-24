import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (!user.email) return Response.json({ linked: false, reason: 'no_email' });

    const sb = base44.asServiceRole;

    // ── Sincronizar el rol de plataforma según el rol del empleado.
    //    "Gerencia" → "gerente" (rol con visibilidad total de OTs y módulos).
    //    Cualquier otro rol → "user" (a menos que sea admin, que se respeta).
    const GERENTE_ROLES = ['gerencia', 'gerente'];
    async function syncPlatformRole(userId, employeeRole, currentPlatformRole) {
      const empRoleNorm = (employeeRole || '').toLowerCase().trim();
      const shouldBe = GERENTE_ROLES.includes(empRoleNorm) ? 'gerente' : 'user';
      // No degradar un admin de plataforma
      if (currentPlatformRole === 'admin') return;
      if (currentPlatformRole === shouldBe) return;
      try {
        await sb.entities.User.update(userId, { role: shouldBe });
      } catch (err) {
        console.warn(`[vincularEmpleado] No se pudo sincronizar role: ${err.message}`);
      }
    }

    // ── AUTO-CURACIÓN: si ya estamos vinculados por user_id pero el email cambió,
    //    actualizar el email de la ficha y continuar. Esto evita que un cambio
    //    de email en la plataforma desvincule al empleado.
    const byUserId = await sb.entities.Employee.filter({ user_id: user.id }).catch(() => []);
    if (byUserId.length > 0) {
      const emp = byUserId[0];
      const empEmail = (emp.email || '').toLowerCase().trim();
      const userEmail = (user.email || '').toLowerCase().trim();
      if (empEmail !== userEmail && userEmail) {
        await sb.entities.Employee.update(emp.id, { email: user.email });
      }
      // Continuar con la lógica normal usando este empleado
      const employeeRole = emp.role || null;
      const empSector = emp.sector_id || 'escuela';

      const updateTasks = [];
      const isEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const platformNameIsEmail = isEmailPattern.test((user.full_name || '').trim());
      const platformNameDiffers = (user.full_name || '').trim() !== (emp.full_name || '').trim();
      if (emp.full_name && (platformNameIsEmail || platformNameDiffers)) {
        updateTasks.push(base44.auth.updateMe({ full_name: emp.full_name }).catch(err => {
          console.warn(`[vincularEmpleado] No se pudo sincronizar full_name: ${err.message}`);
        }));
      }
      const currentUserSector = user.data?.sector_id ?? null;
      if (!currentUserSector) {
        updateTasks.push(base44.auth.updateMe({ sector_id: empSector }).catch(err => {
          console.warn(`[vincularEmpleado] No se pudo sincronizar sector_id: ${err.message}`);
        }));
      }

      let employeePermissions = null;
      if (employeeRole) {
        const roleNorm = employeeRole.toLowerCase().trim();
        let candidates = await sb.entities.RolePermission.filter({ role_name: employeeRole }).catch(() => []);
        if (!candidates || candidates.length === 0) {
          candidates = await sb.entities.RolePermission.list('-created_date', 500).catch(() => []);
        }
        const match = candidates.find(rp => rp.role_name?.toLowerCase().trim() === roleNorm);
        if (match) {
          employeePermissions = match.permissions;
        } else {
          console.warn(`[vincularEmpleado] Rol "${employeeRole}" no tiene RolePermission configurado.`);
        }
      }

      await Promise.allSettled(updateTasks);

      return Response.json({
        linked: true,
        employee_id: emp.id,
        employee_name: emp.full_name,
        employee_role: employeeRole,
        employee_sector: empSector,
        employee_permissions: employeePermissions,
        role_matched: employeePermissions !== null,
      });
    }

    // ── Búsqueda por email (flujo normal para primer login)
    const emailNorm = user.email.toLowerCase().trim();
    const allEmployees = await sb.entities.Employee.filter({ email: user.email }).catch(() => []);

    let matches = allEmployees.filter(
      emp => emp.email?.toLowerCase().trim() === emailNorm
    );

    if (matches.length === 0 && allEmployees.length === 0) {
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
    const empSector = emp.sector_id || 'escuela';

    // Iniciar updates (user_id sync + full_name sync) — corren en paralelo con el lookup de permisos
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
    // Sincronizar sector_id del empleado al usuario de plataforma — SOLO en el primer login
    // (cuando el usuario aún no tiene sector asignado). Después, el sector se gestiona
    // manualmente via la función Observar/Switcher, para no pisar un cambio deliberado.
    const currentUserSector = user.data?.sector_id ?? null;
    if (!currentUserSector) {
      updateTasks.push(base44.auth.updateMe({ sector_id: empSector }).catch(err => {
        console.warn(`[vincularEmpleado] No se pudo sincronizar sector_id: ${err.message}`);
      }));
    }

    // Lookup de permisos por rol — tolerante a mayúsculas/minúsculas
    let employeePermissions = null;
    if (employeeRole) {
      const roleNorm = employeeRole.toLowerCase().trim();
      let candidates = await sb.entities.RolePermission.filter({ role_name: employeeRole }).catch(() => []);
      if (!candidates || candidates.length === 0) {
        candidates = await sb.entities.RolePermission.list('-created_date', 500).catch(() => []);
      }
      const match = candidates.find(rp => rp.role_name?.toLowerCase().trim() === roleNorm);
      if (match) {
        employeePermissions = match.permissions;
      } else {
        console.warn(`[vincularEmpleado] Rol "${employeeRole}" no tiene RolePermission configurado.`);
      }
    }

    // Asegurar que los updates completaron antes de responder
    await Promise.allSettled(updateTasks);

    return Response.json({
      linked: true,
      employee_id: emp.id,
      employee_name: emp.full_name,
      employee_role: employeeRole,
      employee_sector: empSector,
      employee_permissions: employeePermissions,
      role_matched: employeePermissions !== null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});