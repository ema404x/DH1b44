import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Reconciliación automática de empleados ↔ usuarios de plataforma.
 * Solo admins pueden ejecutar esto manualmente; las ejecuciones programadas usan service-role.
 *
 * Corrige:
 * 1. Empleados con user_id cuyo email no coincide con el del usuario → actualiza email
 * 2. Empleados con user_id que apunta a un usuario inexistente → limpia user_id
 * 3. Empleados sin user_id pero con email que coincide con un usuario → vincula
 * 4. Reporta usuarios sin ficha de empleado (no se auto-crean)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sb = base44.asServiceRole;

    // En ejecuciones programadas (sin usuario), usar service-role directamente.
    // En ejecuciones manuales, verificar admin.
    let isAutomated = false;
    try {
      const user = await base44.auth.me();
      if (user && user.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    } catch (_) {
      // Sin usuario (ejecución programada) — continuar con service-role
      isAutomated = true;
    }

    const employees = await sb.entities.Employee.list('-created_date', 2000);
    const users = await sb.entities.User.list('-created_date', 2000);
    const rolePerms = await sb.entities.RolePermission.filter({});

    const permsMap = {};
    rolePerms.forEach(rp => { permsMap[rp.role_name] = rp.permissions; });

    const usersById = {};
    users.forEach(u => { usersById[u.id] = u; });
    const usersByEmail = {};
    users.forEach(u => {
      if (u.email) usersByEmail[u.email.toLowerCase().trim()] = u;
    });

    const fixes = {
      emails_corregidos: [],
      user_ids_limpiados: [],
      vinculados_nuevos: [],
    };

    // 1 & 2: Verificar empleados con user_id
    for (const emp of employees) {
      if (!emp.user_id) continue;
      const platformUser = usersById[emp.user_id];

      if (!platformUser) {
        // user_id apunta a usuario inexistente — limpiar y re-vincular por email si es posible
        const empEmail = (emp.email || '').toLowerCase().trim();
        const matchByEmail = empEmail ? usersByEmail[empEmail] : null;
        if (matchByEmail) {
          await sb.entities.Employee.update(emp.id, { user_id: matchByEmail.id });
          fixes.vinculados_nuevos.push({ employee: emp.full_name, email: emp.email, user_id: matchByEmail.id });
        } else {
          await sb.entities.Employee.update(emp.id, { $unset: { user_id: "" } });
          fixes.user_ids_limpiados.push({ employee: emp.full_name, old_user_id: emp.user_id });
        }
        continue;
      }

      // Email mismatch — el usuario cambió de email en la plataforma
      const empEmail = (emp.email || '').toLowerCase().trim();
      const userEmail = (platformUser.email || '').toLowerCase().trim();
      if (empEmail && userEmail && empEmail !== userEmail) {
        await sb.entities.Employee.update(emp.id, { email: platformUser.email });
        fixes.emails_corregidos.push({
          employee: emp.full_name,
          old_email: emp.email,
          new_email: platformUser.email,
        });
      }
    }

    // 3: Vincular empleados sin user_id pero con email que coincide
    for (const emp of employees) {
      if (emp.user_id) continue;
      const empEmail = (emp.email || '').toLowerCase().trim();
      if (!empEmail) continue;
      const match = usersByEmail[empEmail];
      if (match) {
        await sb.entities.Employee.update(emp.id, { user_id: match.id });
        fixes.vinculados_nuevos.push({ employee: emp.full_name, email: emp.email, user_id: match.id });
      }
    }

    // 4: Reportar usuarios sin ficha
    const employeeEmails = new Set(
      employees.map(e => (e.email || '').toLowerCase().trim()).filter(Boolean)
    );
    const orphanUsers = users
      .filter(u => u.email && !employeeEmails.has(u.email.toLowerCase().trim()))
      .map(u => ({ email: u.email, name: u.full_name, role: u.role }));

    // Construir detalle final
    const vinculados = employees.filter(e => e.user_id);
    const detalle = vinculados.map(emp => ({
      employee_id: emp.id,
      email: emp.email,
      role: emp.role,
      has_permissions: !!permsMap[emp.role],
    }));

    return Response.json({
      success: true,
      automated: isAutomated,
      timestamp: new Date().toISOString(),
      total_vinculados: vinculados.length,
      total_empleados: employees.length,
      total_usuarios: users.length,
      roles_configurados: Object.keys(permsMap),
      correcciones: {
        emails_corregidos: fixes.emails_corregidos.length,
        user_ids_limpiados: fixes.user_ids_limpiados.length,
        vinculados_nuevos: fixes.vinculados_nuevos.length,
      },
      detalle_correcciones: fixes,
      usuarios_sin_ficha: orphanUsers,
      detalle,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});