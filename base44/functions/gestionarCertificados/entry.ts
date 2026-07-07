import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const sb = base44.asServiceRole;
    const ADMIN_EMPLOYEE_ROLES = ['administrativo', 'admin', 'gerente', 'gerencia', 'director'];

    // Verificar si el usuario es gerencia/admin
    let isGerencia = user.role === 'admin';
    if (!isGerencia) {
      const employees = await sb.entities.Employee.filter({ email: user.email }).catch(() => []);
      const emp = employees.find(e => e.email?.toLowerCase().trim() === user.email?.toLowerCase().trim());
      if (emp?.role && ADMIN_EMPLOYEE_ROLES.includes(emp.role.toLowerCase().trim())) {
        isGerencia = true;
      }
    }

    const body = await req.json().catch(() => ({}));
    const { action, certificado_id } = body || {};

    // Obtener un certificado específico (service role — sin RLS)
    // Gerencia puede ver cualquier certificado; otros usuarios solo los que crearon
    if (action === 'get' && certificado_id) {
      const cert = await sb.entities.Certificado.get(certificado_id);
      const isCreator = cert?.created_by_id === user.id;
      if (!isGerencia && !isCreator) {
        return Response.json({ error: 'Forbidden — sin acceso a este certificado' }, { status: 403 });
      }
      return Response.json({ certificado: cert });
    }

    // Listar todos los certificados — solo gerencia
    if (!isGerencia) {
      return Response.json({ error: 'Forbidden — se requiere rol de gerencia' }, { status: 403 });
    }

    const certificados = await sb.entities.Certificado.list('-created_date', 500);
    return Response.json({ certificados });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});