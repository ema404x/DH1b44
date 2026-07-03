import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Roles de empleado con visibilidad total (pueden ver/aprobar todas las solicitudes)
const ADMIN_EMPLOYEE_ROLES = ['gerente', 'gerencia', 'admin', 'administrativo'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { operation = 'list' } = body;

    // ── Determinar si el usuario tiene acceso de gerencia ────────────────
    let isAdmin = user.role === 'admin';

    if (!isAdmin) {
      const employees = await base44.asServiceRole.entities.Employee.filter({ user_id: user.id });
      const emp = employees[0];
      if (emp && ADMIN_EMPLOYEE_ROLES.includes(emp.role?.toLowerCase())) {
        isAdmin = true;
      }
    }

    // ── LIST: obtener solicitudes ────────────────────────────────────────
    if (operation === 'list') {
      const all = await base44.asServiceRole.entities.SolicitudCertificado.list('-created_date');

      if (isAdmin) {
        return Response.json({ solicitudes: all, isAdmin: true });
      }

      // Non-admin: filtrar a las suyas
      const mine = all.filter(s =>
        s.created_by_id === user.id ||
        s.jefe_sitio_email === user.email ||
        s.aprobado_por_email === user.email
      );
      return Response.json({ solicitudes: mine, isAdmin: false });
    }

    // ── UPDATE: actualizar solicitud (y opcionalmente certificado vinculado) ─
    if (operation === 'update') {
      const { id, data, certificado_id, certificado_data } = body;
      if (!id || !data) {
        return Response.json({ error: 'id y data son requeridos' }, { status: 400 });
      }

      // Verificar acceso: admin puede actualizar cualquier solicitud
      // Non-admin solo puede actualizar las suyas
      if (!isAdmin) {
        const sol = await base44.asServiceRole.entities.SolicitudCertificado.get(id);
        if (!sol || (sol.created_by_id !== user.id && sol.jefe_sitio_email !== user.email)) {
          return Response.json({ error: 'Forbidden: sin permisos para modificar esta solicitud' }, { status: 403 });
        }
      }

      const updated = await base44.asServiceRole.entities.SolicitudCertificado.update(id, data);

      // Actualizar certificado vinculado si se proporciona
      if (certificado_id && certificado_data) {
        try {
          await base44.asServiceRole.entities.Certificado.update(certificado_id, certificado_data);
        } catch (e) {
          console.log('Error updating certificado:', e.message);
        }
      }

      return Response.json({ success: true, solicitud: updated });
    }

    // ── DELETE: eliminar solicitud ───────────────────────────────────────
    if (operation === 'delete') {
      const { id } = body;
      if (!id) {
        return Response.json({ error: 'id es requerido' }, { status: 400 });
      }

      if (!isAdmin) {
        const sol = await base44.asServiceRole.entities.SolicitudCertificado.get(id);
        if (!sol || sol.created_by_id !== user.id) {
          return Response.json({ error: 'Forbidden: sin permisos para eliminar esta solicitud' }, { status: 403 });
        }
      }

      await base44.asServiceRole.entities.SolicitudCertificado.delete(id);
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Operación no válida' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});