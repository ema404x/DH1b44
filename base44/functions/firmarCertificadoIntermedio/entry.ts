import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

// Firma/rechazo intermedio en la cadena de firmas de un certificado.
// Valida que el caller sea el firmante actual (el primer 'pendiente' de
// cadena_firmas). Si firma: aplica su firma guardada (Employee.firma_url)
// y avanza al siguiente o transiciona a 'emitido' si era el último.
// Si rechaza: revierte el cert a 'borrador' para que vuelva al creador.
// Sector guard fail-closed en todas las operaciones.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { cert_id, accion, motivo, firma_url } = body || {};

    if (!cert_id) return Response.json({ error: 'Falta cert_id' }, { status: 400 });
    if (!['firmar', 'rechazar'].includes(accion)) return Response.json({ error: 'Acción inválida' }, { status: 400 });
    if (accion === 'rechazar' && !motivo?.trim()) {
      return Response.json({ error: 'El motivo de rechazo es obligatorio' }, { status: 400 });
    }

    const userEmail = (user.email || '').toLowerCase().trim();

    // Sector canónico (fail-closed)
    let callerSector = user.data?.sector_id || user.sector_id || null;
    if (!callerSector && userEmail) {
      const emp = (await base44.asServiceRole.entities.Employee.filter({ email: userEmail }).catch(() => []))[0];
      callerSector = emp?.sector_id || null;
    }
    if (!callerSector && user.id) {
      const emp = (await base44.asServiceRole.entities.Employee.filter({ user_id: user.id }).catch(() => []))[0];
      callerSector = emp?.sector_id || null;
    }
    if (!callerSector) return Response.json({ error: 'Sin sector asignado' }, { status: 403 });

    const sb = base44.asServiceRole;
    const cert = await sb.entities.Certificado.get(cert_id);
    if (!cert) return Response.json({ error: 'Certificado no encontrado' }, { status: 404 });
    if (cert.sector_id !== callerSector) return Response.json({ error: 'Forbidden — certificado de otro sector' }, { status: 403 });
    if (cert.estado !== 'pendiente_firmas') {
      return Response.json({ error: 'El certificado no está pendiente de firmas' }, { status: 400 });
    }

    const cadena = Array.isArray(cert.cadena_firmas) ? [...cert.cadena_firmas] : [];
    const idxActual = cadena.findIndex(f => f.estado === 'pendiente');
    if (idxActual === -1) {
      return Response.json({ error: 'No hay firmante pendiente en la cadena' }, { status: 400 });
    }

    const firmanteActual = cadena[idxActual];
    if ((firmanteActual.email || '').toLowerCase().trim() !== userEmail) {
      return Response.json({ error: 'No es tu turno para firmar este certificado' }, { status: 403 });
    }

    // ── Firmar ──
    if (accion === 'firmar') {
      // Resolver firma guardada del empleado
      let firmaUrl = firma_url || null;
      if (!firmaUrl) {
        const emps = await sb.entities.Employee.filter({ email: userEmail }).catch(() => []);
        firmaUrl = emps[0]?.firma_url || null;
      }
      if (!firmaUrl) {
        return Response.json({
          error: 'sin_firma_guardada',
          mensaje: 'No tenés una firma guardada. Dibujá tu firma para continuar.',
        }, { status: 400 });
      }

      cadena[idxActual] = {
        ...firmanteActual,
        firma_url: firmaUrl,
        fecha_firma: new Date().toISOString(),
        estado: 'firmado',
        firmado_por: firmanteActual.full_name || user.full_name || userEmail,
      };

      const esUltimo = idxActual === cadena.length - 1;
      const nuevoEstado = esUltimo ? 'emitido' : 'pendiente_firmas';

      await sb.entities.Certificado.update(cert_id, {
        cadena_firmas: cadena,
        estado: nuevoEstado,
      });

      return Response.json({
        success: true,
        estado: nuevoEstado,
        mensaje: esUltimo
          ? 'Certificado firmado y enviado a aprobación gerencial'
          : `Firma aplicada. Pendiente ${cadena.length - idxActual - 1} firmante(s) más.`,
      });
    }

    // ── Rechazar ──
    cadena[idxActual] = {
      ...firmanteActual,
      estado: 'rechazado',
      fecha_firma: new Date().toISOString(),
      motivo_rechazo: motivo.trim(),
    };

    await sb.entities.Certificado.update(cert_id, {
      cadena_firmas: cadena,
      estado: 'borrador',
    });

    return Response.json({
      success: true,
      estado: 'borrador',
      mensaje: `Certificado rechazado y devuelto al creador: ${motivo.trim()}`,
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Error inesperado' }, { status: 500 });
  }
}