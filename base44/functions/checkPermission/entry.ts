import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Los admins de plataforma tienen acceso total
    if (user.role === 'admin') {
      return Response.json({ allowed: true, permissions: {}, role: 'admin' });
    }

    const body = await req.json();
    const { module, action } = body;

    if (!module || !action) {
      return Response.json({ error: 'module y action son requeridos' }, { status: 400 });
    }

    // Buscar el empleado vinculado a este usuario por email
    const employees = await base44.asServiceRole.entities.Employee.filter({});
    const emp = employees.find(
      e => e.email?.toLowerCase().trim() === user.email?.toLowerCase().trim()
    );

    if (!emp || !emp.role) {
      return Response.json({ allowed: false, reason: 'Employee not found or has no role' }, { status: 403 });
    }

    // Buscar el RolePermission por el rol del empleado (case-insensitive)
    const allRolePerms = await base44.asServiceRole.entities.RolePermission.filter({});
    const roleMatch = allRolePerms.find(
      rp => rp.role_name?.toLowerCase().trim() === emp.role.toLowerCase().trim()
    );

    if (!roleMatch) {
      return Response.json({ allowed: false, reason: `Role "${emp.role}" not configured` }, { status: 403 });
    }

    const perms = roleMatch.permissions[module];
    const allowed = !!(perms && perms[action] === true);

    return Response.json({
      allowed,
      permissions: perms || {},
      role: emp.role,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});