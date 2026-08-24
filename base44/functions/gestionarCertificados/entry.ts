import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { certVisibleToUser } from "../../shared/certVisibility.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const sb = base44.asServiceRole;
    // Fail closed en sector: sin sector → 403. NUNCA defaultear a 'escuela'.
    const callerSector = user.data?.sector_id || user.sector_id;
    if (!callerSector) {
      return Response.json({ error: 'Sin sector asignado' }, { status: 403 });
    }
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

    // Obtener un certificado específico (service role — sin RLS).
    // Gerencia/admin ven cualquier cert de su sector (oversight/aprobación).
    // El resto ve solo los certs que crearon, resuelto de forma robusta vía
    // certVisibleToUser — que incluye el dueño real (jefe_sitio_email de la
    // SolicitudCertificado vinculada) para los certs de service-role cuyo
    // created_by_id="service_..." no matchea ningún humano. Sin esto, un jefe
    // que generó su cert vía emitirCertificado no puede verlo (403) — caso
    // Gastón Massa / CERT-3AA160.
    if (action === 'get' && certificado_id) {
      const cert = await sb.entities.Certificado.get(certificado_id);
      if (!cert) {
        return Response.json({ error: 'Certificado no encontrado' }, { status: 404 });
      }
      // Fail-closed: sector debe coincidir exactamente. Sin bypass por rol.
      if (cert.sector_id !== callerSector) {
        return Response.json({ error: 'Forbidden — certificado de otro sector. Cambiá de sector activo.' }, { status: 403 });
      }
      if (isGerencia) {
        return Response.json({ certificado: cert });
      }
      // No-gerencia: resolver propiedad (incluye solicitud vinculada).
      const sols = await sb.entities.SolicitudCertificado.filter({ certificado_id }).catch(() => []);
      if (!certVisibleToUser(cert, user, callerSector, sols || [])) {
        return Response.json({ error: 'Forbidden — sin acceso a este certificado' }, { status: 403 });
      }
      return Response.json({ certificado: cert });
    }

    // Listar todos los certificados — solo gerencia
    if (!isGerencia) {
      return Response.json({ error: 'Forbidden — se requiere rol de gerencia' }, { status: 403 });
    }

    // Filtrar por sector del usuario — aisla datos entre sectores (fail closed)
    const certificados = await sb.entities.Certificado.filter({ sector_id: callerSector });
    return Response.json({ certificados });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});