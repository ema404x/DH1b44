import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Fuerza la re-sincronización de todos los empleados vinculados.
 * Solo admins pueden ejecutar esto.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Obtener todos los empleados con user_id vinculado
    const employees = await base44.asServiceRole.entities.Employee.filter({});
    const vinculados = employees.filter(e => e.user_id && e.email);

    // Obtener todos los RolePermission
    const rolePerms = await base44.asServiceRole.entities.RolePermission.filter({});
    const permsMap = {};
    rolePerms.forEach(rp => { permsMap[rp.role_name] = rp.permissions; });

    const results = [];
    for (const emp of vinculados) {
      const permissions = permsMap[emp.role] || null;
      results.push({
        employee_id: emp.id,
        email: emp.email,
        role: emp.role,
        has_permissions: !!permissions
      });
    }

    return Response.json({
      success: true,
      total_vinculados: vinculados.length,
      roles_configurados: Object.keys(permsMap),
      detalle: results
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});