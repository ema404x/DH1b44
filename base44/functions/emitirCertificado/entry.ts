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
    const { id: _id, cadena_firmas: cadenaRaw, ...rest } = data;
    // Cadena de firmas: si viene configurada, el cert arranca en
    // 'pendiente_firmas' (espera firmas intermedias antes de llegar al
    // gerente). Sin cadena → directo a 'emitido' como hoy.
    // Certificado existente (mismo id) → se actualiza, nunca se duplica.
    let existing = null;
    if (editing_id) {
      existing = await base44.asServiceRole.entities.Certificado.get(editing_id).catch(() => null);
      if (existing && existing.sector_id && existing.sector_id !== callerSector) {
        return Response.json({ error: 'Forbidden — certificado de otro sector' }, { status: 403 });
      }
    }
    // Conservar firmas ya completadas (por email) al re-emitir.
    const firmadosPrevios = new Map(
      (Array.isArray(existing?.cadena_firmas) ? existing.cadena_firmas : [])
        .filter(f => f?.estado === 'firmado' && f.email)
        .map(f => [f.email.toLowerCase().trim(), f])
    );
    const cadenaFirmas = Array.isArray(cadenaRaw)
      ? cadenaRaw.filter(f => f && f.email).map(f => {
          const email = (f.email || '').toLowerCase().trim();
          const previo = firmadosPrevios.get(email) || (f.estado === 'firmado' ? f : null);
          if (previo) return { ...previo, email };
          return { user_id: f.user_id || null, email, full_name: f.full_name || '', estado: 'pendiente' };
        })
      : [];
    const hayPendientes = cadenaFirmas.some(f => f.estado === 'pendiente');
    const estadoInicial = hayPendientes ? 'pendiente_firmas' : 'emitido';
    const certPayload = { ...rest, estado: estadoInicial, sector_id: callerSector, creado_por_email: existing?.creado_por_email || userEmail, cadena_firmas: cadenaFirmas };
    const cert = existing
      ? await base44.asServiceRole.entities.Certificado.update(existing.id, certPayload)
      : await base44.asServiceRole.entities.Certificado.create(certPayload);
    if (existing) {
      // Limpiar solicitudes previas del mismo cert para no duplicar la bandeja.
      const viejas = await base44.asServiceRole.entities.SolicitudCertificado.filter({ certificado_id: existing.id });
      for (const sol of viejas) {
        await base44.asServiceRole.entities.SolicitudCertificado.delete(sol.id).catch(() => {});
      }
    }

    // 2) Crear la solicitud de aprobación (vinculada al nuevo cert).
    //    Solo si el certificado va directo al gerente (sin cadena de firmas).
    //    Si tiene cadena, arranca en 'pendiente_firmas' y la solicitud se
    //    crea recién cuando el último firmante completa la cadena
    //    (firmarCertificadoIntermedio). Así el gerente no lo ve en su bandeja
    //    hasta que la cadena esté completa.
    let solicitudCreada = true;
    let solicitudError = null;
    if (estadoInicial === 'emitido') {
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
    }

    // 3) Solo si el nuevo cert + solicitud OK, limpiar el borrador/aprobado previo
    //    (y sus solicitudes asociadas). Best-effort: no bloquea el éxito.
    //    Guard de sector: nunca borrar un cert de otro sector.
    if (!existing && solicitudCreada && editing_id && (editing_estado === 'borrador' || editing_estado === 'aprobado')) {
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
      mensaje: !solicitudCreada
        ? 'Certificado emitido, pero no se pudo crear la solicitud de aprobación. Reintenta desde Aprobación de Certificados.'
        : estadoInicial === 'pendiente_firmas'
          ? 'Certificado enviado a firma intermedia. Llegará al gerente una vez completada la cadena de firmas.'
          : 'Certificado emitido y enviado a aprobación gerencial',
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Error al emitir el certificado' }, { status: 500 });
  }
}