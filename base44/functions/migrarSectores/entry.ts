import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — solo administradores' }, { status: 403 });

    const sb = base44.asServiceRole;
    const results = {};

    // 1. Empleados: asignar sector "escuela" a registros sin sector_id
    const empRes = await sb.entities.Employee.updateMany(
      { sector_id: null },
      { $set: { sector_id: 'escuela' } }
    ).catch(e => ({ error: e.message }));
    results.employee = empRes;

    // 2. Usuarios de plataforma: asignar sector "escuela" (puede no estar permitido — se ignora el error)
    const userRes = await sb.entities.User.updateMany(
      { sector_id: null },
      { $set: { sector_id: 'escuela' } }
    ).catch(e => ({ error: e.message }));
    results.user = userRes;

    return Response.json({ success: true, migrated: results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});