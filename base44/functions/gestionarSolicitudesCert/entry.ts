import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Roles de empleado con visibilidad total (pueden ver/aprobar todas las solicitudes)
const ADMIN_EMPLOYEE_ROLES = ['gerente', 'gerencia', 'admin', 'administrativo'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Fail closed en sector: sin sector → 403. NUNCA defaultear a 'escuela'.
    // Fallback robusto: si user.data.sector_id falta (estado stale / transición de
    // sector), usar la ficha de Empleado como fuente de verdad. user.data tiene
    // prioridad para NO alterar el comportamiento de las operaciones existentes
    // cuando está poblado — el lookup a Employee solo corre en el caso de falta.
    const userEmail = (user.email || '').toLowerCase().trim();
    let employeeFallback = null;
    if (!user.data?.sector_id) {
      if (userEmail) {
        const empResults = await base44.asServiceRole.entities.Employee.filter({ email: userEmail });
        employeeFallback = empResults[0] || null;
      }
      if (!employeeFallback && user.id) {
        const empByUserId = await base44.asServiceRole.entities.Employee.filter({ user_id: user.id });
        employeeFallback = empByUserId[0] || null;
      }
    }
    const callerSector = user.data?.sector_id || employeeFallback?.sector_id || user.sector_id;
    if (!callerSector) {
      return Response.json({ error: 'Sin sector asignado' }, { status: 403 });
    }

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
      // Filtrar por sector del usuario — aisla datos entre sectores (fail closed)
      const all = await base44.asServiceRole.entities.SolicitudCertificado.filter({ sector_id: callerSector });

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

      // Verificar acceso + aislamiento por sector (incluso admins quedan scopeados a su sector)
      const sol = await base44.asServiceRole.entities.SolicitudCertificado.get(id);
      if (!sol) {
        return Response.json({ error: 'Solicitud no encontrada' }, { status: 404 });
      }
      // Fail-closed: si la solicitud no tiene sector o no coincide, bloquear.
      if (sol.sector_id !== callerSector) {
        return Response.json({ error: 'Forbidden: solicitud de otro sector' }, { status: 403 });
      }
      if (!isAdmin && sol.created_by_id !== user.id && sol.jefe_sitio_email !== user.email) {
        return Response.json({ error: 'Forbidden: sin permisos para modificar esta solicitud' }, { status: 403 });
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

      const sol = await base44.asServiceRole.entities.SolicitudCertificado.get(id);
      if (!sol) {
        return Response.json({ error: 'Solicitud no encontrada' }, { status: 404 });
      }
      // Fail-closed: si la solicitud no tiene sector o no coincide, bloquear.
      if (sol.sector_id !== callerSector) {
        return Response.json({ error: 'Forbidden: solicitud de otro sector' }, { status: 403 });
      }
      if (!isAdmin && sol.created_by_id !== user.id) {
        return Response.json({ error: 'Forbidden: sin permisos para eliminar esta solicitud' }, { status: 403 });
      }

      await base44.asServiceRole.entities.SolicitudCertificado.delete(id);
      return Response.json({ success: true });
    }

    // ── SANEAMIENTO HUERFANAS: borrar solicitudes cuyo certificado_id apunta a
    //    un Certificado que ya no existe. Solo admin. Sector-scoped. Idempotente.
    //    Defensa en profundidad: verifica sector de la solicitud antes de borrar
    //    y trata un cert de OTRO sector como inexistente (no rompe aislamiento).
    if (operation === 'saneamiento_huerfanas') {
      if (!isAdmin) {
        return Response.json({ error: 'Solo un administrador puede ejecutar el saneamiento' }, { status: 403 });
      }
      const all = await base44.asServiceRole.entities.SolicitudCertificado.filter({ sector_id: callerSector });
      const conCert = all.filter(s => s.certificado_id);
      if (conCert.length === 0) {
        return Response.json({ total_revisadas: all.length, con_certificado: 0, huerfanas_eliminadas: 0, ids_eliminados: [] });
      }
      const certIds = [...new Set(conCert.map(s => s.certificado_id))];
      const certIdsExistentes = new Set();
      await Promise.all(certIds.map(async (cid) => {
        try {
          const cert = await base44.asServiceRole.entities.Certificado.get(cid);
          if (cert && cert.sector_id === callerSector) certIdsExistentes.add(cid);
        } catch (_) { /* cert inexistente → huérfana */ }
      }));
      const huerfanas = conCert.filter(s => !certIdsExistentes.has(s.certificado_id));
      const ids_eliminados = [];
      for (const s of huerfanas) {
        if (s.sector_id !== callerSector) continue;
        try {
          await base44.asServiceRole.entities.SolicitudCertificado.delete(s.id);
          ids_eliminados.push(s.id);
        } catch (e) {
          console.log('No se pudo eliminar solicitud huérfana', s.id, e.message);
        }
      }
      return Response.json({
        total_revisadas: all.length,
        con_certificado: conCert.length,
        huerfanas_eliminadas: ids_eliminados.length,
        ids_eliminados,
      });
    }

    return Response.json({ error: 'Operación no válida' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});