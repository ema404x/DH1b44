import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Obtener todos los usuarios y empleados
    const allUsers = await base44.asServiceRole.entities.User.list();
    const allEmployees = await base44.asServiceRole.entities.Employee.list();

    let synced = 0;
    let errors = [];

    for (const user of allUsers) {
      if (!user.email) continue;

      // Buscar empleados con este email (case-insensitive)
      const matches = allEmployees.filter(
        emp => emp.email?.toLowerCase().trim() === user.email.toLowerCase().trim()
      );

      if (matches.length === 0) continue;

      // Si hay múltiples, priorizar: ya vinculado > activo > primero
      let emp;
      if (matches.length > 1) {
        const alreadyLinked = matches.find(e => e.user_id === user.id);
        if (alreadyLinked) {
          emp = alreadyLinked;
        } else {
          const activeEmployees = matches.filter(e => e.status === 'activo');
          emp = activeEmployees.length > 0 ? activeEmployees[0] : matches[0];
        }

        // Desvinicular los otros
        for (const other of matches) {
          if (other.id !== emp.id && other.user_id === user.id) {
            try {
              await base44.asServiceRole.entities.Employee.update(other.id, { user_id: null });
            } catch (e) {
              errors.push(`Error al desvincular ${other.full_name}: ${e.message}`);
            }
          }
        }
      } else {
        emp = matches[0];
      }

      // Actualizar vinculación
      try {
        if (emp.user_id !== user.id) {
          await base44.asServiceRole.entities.Employee.update(emp.id, { user_id: user.id });
          synced++;
        }
      } catch (e) {
        errors.push(`Error al vincular ${emp.full_name}: ${e.message}`);
      }
    }

    return Response.json({
      success: true,
      synced,
      total_users: allUsers.length,
      total_employees: allEmployees.length,
      errors: errors.length > 0 ? errors : null
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});