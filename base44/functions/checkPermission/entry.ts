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

    // Buscar el empleado vinculado a este usuario por email — con reintento ante fallos transitorios
    let emp = null;
    let lookupFailed = false;
    for (let attempt = 1; attempt <= 2 && !emp; attempt++) {
      try {
        const employees = await base44.asServiceRole.entities.Employee.filter({ email: user.email });
        emp = employees.find(e => e.email?.toLowerCase().trim() === user.email?.toLowerCase().trim());
        if (!emp && employees.length === 0) {
          const allEmployees = await base44.asServiceRole.entities.Employee.list('-created_date', 2000);
          emp = allEmployees.find(e => e.email?.toLowerCase().trim() === user.email?.toLowerCase().trim());
        }
      } catch (e) {
        lookupFailed = true;
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
      }
    }

    // Si el lookup falló por error de red/servidor, devolver 503 (no 403) para distinguir
    // "no se pudo verificar" de "verificado y denegado"
    if (lookupFailed && !emp) {
      return Response.json(
        { error: 'No se pudo verificar el empleado en este momento', transient: true },
        { status: 503 }
      );
    }

    if (!emp || !emp.role) {
      return Response.json({ allowed: false, reason: 'Employee not found or has no role' }, { status: 403 });
    }

    // Buscar el RolePermission por el rol del empleado (case-insensitive)
    let roleCandidates = await base44.asServiceRole.entities.RolePermission.filter({ role_name: emp.role }).catch(() => []);
    if (!roleCandidates || roleCandidates.length === 0) {
      roleCandidates = await base44.asServiceRole.entities.RolePermission.list('-created_date', 500).catch(() => []);
    }
    const roleMatch = roleCandidates.find(
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