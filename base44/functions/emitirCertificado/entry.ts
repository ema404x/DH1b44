import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Emisión robusta de certificados: crea el Certificado (estado 'emitido') con
// sector_id garantizado, crea la SolicitudCertificado de aprobación, y solo
// si ambas OK borra el borrador/aprobado previo (admin-level via service role).
// Devuelve el cert creado y su tipo para que el frontend swithee a la pestaña
// correcta. Si algo falla, el error se reporta claro y no quedan registros
// huérfanos (el borrador viejo solo se borra si todo lo demás OK).

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { data, editing_id, editing_estado, display_name, user_email } = body;
    if (!data) return Response.json({ error: 'Falta el payload del certificado' }, { status: 400 });

    // Sector canónico desde la ficha de Empleado
    const userEmail = (user_email || user.email || '').toLowerCase().trim();
    let employee = null;
    if (userEmail) {
      const empResults = await base44.asServiceRole.entities.Employee.filter({ email: userEmail });
      employee = empResults[0] || null;
    }
    if (!employee && user.id) {
      const empByUserId = await base44.asServiceRole.entities.Employee.filter({ user_id: user.id });
      employee = empByUserId[0] || null;
    }
    const callerSector = employee?.sector_id || user.data?.sector_id || user.sector_id;
    if (!callerSector) {
      return Response.json({ error: 'Sin sector asignado' }, { status: 403 });
    }

    const displayName = display_name || employee?.full_name || user.full_name || user.email;

    // 1) Crear el certificado emitido con sector_id garantizado y email del
    //    creador estampado. Como el cert se crea via service role, created_by_id
    //    queda en null — sin creado_por_email el creador perdería visibilidad RLS
    //    mientras el cert está 'emitido' (pendiente de aprobación gerencial),
    //    ya que aprobado_por_email solo se setea al aprobar.
    const { id: _id, ...rest } = data;
    const certPayload = { ...rest, estado: 'emitido', sector_id: callerSector, creado_por_email: userEmail };
    const cert = await base44.asServiceRole.entities.Certificado.create(certPayload);

    // 2) Crear la solicitud de aprobación (vinculada al nuevo cert)
    let solicitudCreada = true;
    let solicitudError = null;
    try {
      const numero = `CERT-${cert.id.slice(-6).toUpperCase()}`;
      await base44.asServiceRole.entities.SolicitudCertificado.create({
        numero,
        titulo: `Certificado N°${cert.numero} — ${cert.contratista || cert.emprendimiento || ''}`,
        establecimiento: cert.emprendimiento || cert.obra_servicio || '',
        jefe_sitio: displayName,
        jefe_sitio_email: userEmail,
        descripcion_trabajo: cert.obra_servicio || '',
        monto_solicitado: cert.subtotal || cert.monto_contratado || 0,
        porcentaje_avance: cert.porcentaje_avance || 0,
        periodo: cert.mes_periodo || '',
        estado: 'enviada',
        certificado_id: cert.id,
        sector_id: callerSector,
        historial: [{
          fecha: new Date().toISOString(),
          estado: 'enviada',
          usuario: displayName,
          comentario: 'Certificado emitido — enviado automáticamente para aprobación',
        }],
      });
    } catch (e) {
      solicitudCreada = false;
      solicitudError = e.message;
    }

    // 3) Solo si el nuevo cert + solicitud OK, limpiar el borrador/aprobado previo
    //    (y sus solicitudes asociadas). Best-effort: no bloquea el éxito.
    //    Guard de sector: nunca borrar un cert de otro sector.
    if (solicitudCreada && editing_id && (editing_estado === 'borrador' || editing_estado === 'aprobado')) {
      try {
        let oldCert = null;
        try { oldCert = await base44.asServiceRole.entities.Certificado.get(editing_id); } catch (_) {}
        if (oldCert && (!oldCert.sector_id || oldCert.sector_id === callerSector)) {
          // Borrar solicitudes viejas vinculadas al cert anterior
          const viejasSolicitudes = await base44.asServiceRole.entities.SolicitudCertificado.filter({ certificado_id: editing_id });
          for (const sol of viejasSolicitudes) {
            await base44.asServiceRole.entities.SolicitudCertificado.delete(sol.id).catch(() => {});
          }
          await base44.asServiceRole.entities.Certificado.delete(editing_id).catch(() => {});
        }
      } catch (_) { /* no bloquear el flujo si falla la limpieza */ }
    }

    return Response.json({
      success: true,
      cert,
      tipo: cert.tipo,
      solicitud_creada: solicitudCreada,
      solicitud_error: solicitudError,
      mensaje: solicitudCreada
        ? 'Certificado emitido y enviado a aprobación gerencial'
        : 'Certificado emitido, pero no se pudo crear la solicitud de aprobación. Reintenta desde Aprobación de Certificados.',
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Error al emitir el certificado' }, { status: 500 });
  }
}