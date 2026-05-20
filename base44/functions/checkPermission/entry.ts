import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

    // Obtener permisos del rol del usuario
    const rolePerms = await base44.asServiceRole.entities.RolePermission.filter({
      role_name: user.role || 'user'
    });

    if (!rolePerms || rolePerms.length === 0) {
      return Response.json({ allowed: false, reason: 'Role not configured' }, { status: 403 });
    }

    const perms = rolePerms[0].permissions[module];
    const allowed = !!(perms && perms[action] === true);

    return Response.json({ 
      allowed, 
      permissions: perms || {},
      role: user.role 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});