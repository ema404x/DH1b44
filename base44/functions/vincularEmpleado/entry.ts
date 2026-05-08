import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Verificar que el usuario esté autenticado
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.email) {
      return Response.json({ linked: false, reason: 'no_email' });
    }

    // Buscar fichas de empleado con el mismo email (normalizado a minúsculas)
    const allEmployees = await base44.asServiceRole.entities.Employee.filter({});
    const matches = allEmployees.filter(
      emp => emp.email?.toLowerCase().trim() === user.email.toLowerCase().trim()
    );

    if (matches.length === 0) {
      return Response.json({ linked: false, reason: 'no_match' });
    }

    if (matches.length > 1) {
      // Advertencia: múltiples fichas con el mismo email, vincular solo la primera
      console.warn(`Múltiples fichas con email ${user.email}: ${matches.map(e => e.id).join(', ')}`);
    }

    const emp = matches[0];

    // Solo actualizar si aún no está vinculado correctamente
    if (emp.user_id === user.id) {
      return Response.json({ linked: true, employee_id: emp.id, already_linked: true });
    }

    await base44.asServiceRole.entities.Employee.update(emp.id, { user_id: user.id });

    return Response.json({ linked: true, employee_id: emp.id, already_linked: false });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});