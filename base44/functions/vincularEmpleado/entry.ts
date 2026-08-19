import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { shouldSyncToGerente } from "../../shared/roles.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (!user.email) return Response.json({ linked: false, reason: 'no_email' });

    const sb = base44.asServiceRole;

    // ── Sincronizar el rol de plataforma según el rol del empleado.
    //    Definición centralizada en shared/roles.ts — shouldSyncToGerente().
    async function syncPlatformRole(userId, employeeRole, currentPlatformRole) {
      const shouldBe = shouldSyncToGerente(employeeRole) ? 'gerente' : 'user';
      if (shouldBe !== 'gerente' && shouldBe !== 'user') {
        console.error(`[vincularEmpleado] shouldBe inesperado: ${shouldBe} — abort sync`);
        return;
      }
      if (currentPlatformRole === 'admin') return;
      if (currentPlatformRole === shouldBe) return;
      try {
        await sb.entities.User.update(userId, { role: shouldBe });
      } catch (err) {
        console.warn(`[vincularEmpleado] No se pudo sincronizar role: ${err.message}`);
      }
    }

    // ── AUTO-CURACIÓN: si ya estamos vinculados por user_id pero el email cambió,
    //    actualizar el email de la ficha y continuar.
    const byUserId = await sb.entities.Employee.filter({ user_id: user.id }).catch(() => []);
    if (byUserId.length > 0) {
      const emp = byUserId[0];
      const empEmail = (emp.email || '').toLowerCase().trim();
      const userEmail = (user.email || '').toLowerCase().trim();
      if (empEmail !== userEmail && userEmail) {
        await sb.entities.Employee.update(emp.id, { email: user.email }).catch(() => {});
      }
      const employeeRole = emp.role || null;
      const empSector = emp.sector_id || '';

      // Sincronizar rol de plataforma — fire and forget
      syncPlatformRole(user.id, employeeRole, user.role).catch(() => {});

      // Lookup de permisos PRIMERO — es lo que el frontend necesita para desbloquear el acceso
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

      // Fire-and-forget: los updates de nombre/sector no bloquean la respuesta.
      // Usamos asServiceRole para bypassar la RLS de User.update (admin-only).
      const updateTasks = [];
      const isEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const platformNameIsEmail = isEmailPattern.test((user.full_name || '').trim());
      const platformNameDiffers = (user.full_name || '').trim() !== (emp.full_name || '').trim();
      const userUpdate = {};
      if (emp.full_name && (platformNameIsEmail || platformNameDiffers)) {
        userUpdate.full_name = emp.full_name;
      }
      const currentUserSector = user.data?.sector_id ?? null;
      if (!currentUserSector && empSector) {
        userUpdate.sector_id = empSector;
      }
      if (Object.keys(userUpdate).length > 0) {
        updateTasks.push(sb.entities.User.update(user.id, userUpdate).catch(() => {}));
      }
      Promise.allSettled(updateTasks).catch(() => {});

      return Response.json({
        linked: true,
        fallback: false,
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

    if (matches.length === 0) {
      // ── NUNCA DESVINCULAR ──
      // Si no se encontró ficha por user_id ni por email, NO bloquear al usuario.
      // Se retorna linked:true con acceso mínimo (rol 'user', sin employee_id).
      const fallbackSector = user.data?.sector_id || '';
      return Response.json({
        linked: true,
        employee_id: null,
        employee_name: user.full_name || user.email,
        employee_role: 'user',
        employee_sector: fallbackSector,
        employee_permissions: {},
        role_matched: false,
        fallback: true,
      });
    }

    // Elegir el empleado a vincular
    let emp;
    if (matches.length > 1) {
      // Preferir el empleado del MISMO sector que el usuario activo — evita
      // vincular a una ficha de otro sector y desincronizar la identidad.
      const currentUserSector = user.data?.sector_id || user.sector_id;
      emp = matches.find(e => e.user_id === user.id)
         || (currentUserSector ? matches.find(e => e.sector_id === currentUserSector) : null)
         || matches.find(e => e.status === 'activo')
         || matches[0];
      console.warn(`[vincularEmpleado] Múltiples fichas con email ${user.email}: vinculando a ${emp.full_name} (${emp.id})`);
    } else {
      emp = matches[0];
    }

    const employeeRole = emp.role || null;
    const empSector = emp.sector_id || '';

    // Sincronizar rol de plataforma — fire and forget
    syncPlatformRole(user.id, employeeRole, user.role).catch(() => {});

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

    // Fire-and-forget: los updates de user_id/nombre/sector no bloquean la respuesta.
    // Usamos asServiceRole para bypassar la RLS de User.update (admin-only).
    const updateTasks = [];
    if (emp.user_id !== user.id) {
      updateTasks.push(sb.entities.Employee.update(emp.id, { user_id: user.id }).catch(() => {}));
    }
    const isEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const platformNameIsEmail = isEmailPattern.test((user.full_name || '').trim());
    const platformNameDiffers = (user.full_name || '').trim() !== (emp.full_name || '').trim();
    const userUpdate = {};
    if (emp.full_name && (platformNameIsEmail || platformNameDiffers)) {
      userUpdate.full_name = emp.full_name;
    }
    const currentUserSector = user.data?.sector_id ?? null;
    if (!currentUserSector && empSector) {
      userUpdate.sector_id = empSector;
    }
    if (Object.keys(userUpdate).length > 0) {
      updateTasks.push(sb.entities.User.update(user.id, userUpdate).catch(() => {}));
    }
    Promise.allSettled(updateTasks).catch(() => {});

    return Response.json({
      linked: true,
      fallback: false,
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