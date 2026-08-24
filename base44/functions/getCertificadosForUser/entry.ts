import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Visibilidad de certificados por propietario (regla de oro: backend-first
// cuando el RLS no resuelve de forma confiable quién es el dueño de cada registro).
//
// PROBLEMA
//   Los certificados creados vía service role (emitirCertificado,
//   generateMonthlyCertificates) tienen created_by_id = "service_..." (no es
//   un usuario humano) y creado_por_email puede faltar. El dueño real —el
//   jefe de sitio que generó/firmó el cert— solo figura en la
//   SolicitudCertificado vinculada (campo jefe_sitio_email), NO en el cert.
//   Por eso un jefe como Gastón Massa no ve sus propios certificados: el RLS
//   del Certificado no puede matchearlo contra ningún campo del registro.
//
// SOLUCIÓN
//   Un único backend que resuelve el propietario de forma robusta y devuelve
//   solo los certs que le corresponden al caller. Sector-scoped fail-closed.
//   Aplica a ambos sectores sin lógica específica (el sector sale del caller).
//
// REGLAS
//   - Admin: ve todos los certs de su sector (oversight).
//   - Resto (gerente, jefe_sitio, user): ve SOLO los certs donde es el dueño:
//       * created_by_id == user.id          (creados vía frontend/borrador)
//       * creado_por_email == user.email    (creados vía emitirCertificado)
//       * aprobado_por_email == user.email  (aprobados por él)
//       * SolicitudCertificado vinculada con jefe_sitio_email == user.email
//         (certs de service-role emitidos para/su jefe — caso Gastón)

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });

    const userEmail = (user.email || '').toLowerCase().trim();

    // ── Sector canónico del caller (fail-closed) ──
    // user.data.sector_id primero; si falta (estado stale), backstop en la
    // ficha Employee. Sin sector → 403 (nunca defaultear).
    let callerSector = user.data?.sector_id || user.sector_id || null;
    if (!callerSector && userEmail) {
      const emp = (await base44.asServiceRole.entities.Employee.filter({ email: userEmail }).catch(() => []))[0];
      callerSector = emp?.sector_id || null;
    }
    if (!callerSector && user.id) {
      const emp = (await base44.asServiceRole.entities.Employee.filter({ user_id: user.id }).catch(() => []))[0];
      callerSector = emp?.sector_id || null;
    }
    if (!callerSector) {
      return Response.json({ error: 'Sin sector asignado' }, { status: 403 });
    }

    const sb = base44.asServiceRole;

    // ── Admin: ve todo su sector ──
    if (user.role === 'admin') {
      const all = await sb.entities.Certificado.filter({ sector_id: callerSector }, '-created_date', 500);
      return Response.json({ certificados: all, isAdmin: true });
    }

    // ── Resto: resolver por propietario (2 queries + join en memoria) ──
    const [allCerts, sols] = await Promise.all([
      sb.entities.Certificado.filter({ sector_id: callerSector }, '-created_date', 500).catch(() => []),
      userEmail
        ? sb.entities.SolicitudCertificado.filter({ sector_id: callerSector, jefe_sitio_email: userEmail }).catch(() => [])
        : [],
    ]);

    // IDs de certs vinculados a solicitudes donde el jefe es el caller.
    // Es el camino que resuelve los certs de service-role cuyo dueño real
    // (jefe_sitio_email) solo está en la solicitud — caso Gastón Massa.
    const certIdsFromSols = new Set(
      (sols || []).map(s => s.certificado_id).filter(Boolean)
    );

    const mine = (allCerts || []).filter(c => {
      if (c.sector_id && c.sector_id !== callerSector) return false; // defensa en profundidad
      if (c.created_by_id && c.created_by_id === user.id) return true;
      if (userEmail && (c.creado_por_email || '').toLowerCase() === userEmail) return true;
      if (userEmail && (c.aprobado_por_email || '').toLowerCase() === userEmail) return true;
      if (c.id && certIdsFromSols.has(c.id)) return true;
      return false;
    });

    // Ya vienen ordenados por created_date desc desde el filter; re-aseguramos.
    mine.sort((a, b) => new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime());

    return Response.json({ certificados: mine, isAdmin: false });
  } catch (error) {
    return Response.json({ error: error.message || 'Error inesperado' }, { status: 500 });
  }
});