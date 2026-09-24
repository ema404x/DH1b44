import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveAndReconcileSector } from "../../shared/callerIdentity.ts";
import { resolveAdminView, norm, loadRolePermissions } from "../../shared/visibilityResolver.ts";
import { certVisibleToUser } from "../../shared/certVisibility.ts";

// Elimina un certificado respetando el Control de Acceso (RolePermission).
//
// PROBLEMA
//   El frontend hacía base44.entities.Certificado.delete(id) directo desde el
//   cliente. Ese delete pasa por la RLS de Certificado.delete, que SÓLO permite
//   role='admin'. Un jefe de sitio con Certificado.delete=true en su
//   RolePermission quedaba bloqueado por RLS aunque el control de acceso lo
//   autorizara.
//
// SOLUCIÓN
//   Misma arquitectura que eliminarOT: service role + guard de sector explícito
//   + chequeo de RolePermission.Certificado.delete. Si el rol no tiene
//   delete configurado (undefined), cae al fallback: admin/gerente pueden
//   borrar certs de su sector (comportamiento legacy).

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { certificado_id } = body;
    if (!certificado_id) return Response.json({ error: 'Falta certificado_id' }, { status: 400 });

    const sb = base44.asServiceRole;

    // Resolver identidad canónica del caller (sector + ficha de empleado)
    const { sector: callerSector, employee } = await resolveAndReconcileSector(sb, user);
    if (!callerSector) {
      return Response.json({ error: 'Sin sector asignado' }, { status: 403 });
    }

    // Leer el certificado via service role (bypass RLS)
    let cert = null;
    try {
      cert = await sb.entities.Certificado.get(certificado_id);
    } catch (_) { /* not found */ }
    if (!cert) return Response.json({ error: 'Certificado no encontrado' }, { status: 404 });

    // Aislamiento por sector
    if (cert.sector_id !== callerSector) {
      return Response.json({ error: 'Este certificado pertenece a otro sector.' }, { status: 403 });
    }

    // Super-admin puro (sin ficha de empleado) → acceso total
    const superAdmin = !employee || !employee.role;
    if (superAdmin) {
      // También borrar la solicitud vinculada si existe
      const sols = await sb.entities.SolicitudCertificado.filter({ certificado_id }).catch(() => []);
      for (const s of (sols || [])) {
        await sb.entities.SolicitudCertificado.delete(s.id).catch(() => {});
      }
      await sb.entities.Certificado.delete(certificado_id);
      return Response.json({ success: true, mensaje: 'Certificado eliminado correctamente' });
    }

    // Verificar permiso de borrado vía RolePermission
    let perms = null;
    try {
      const allRps = await loadRolePermissions(sb);
      const rp = (allRps || []).find((r: any) => norm(r.role_name) === norm(employee.role));
      perms = rp?.permissions?.['Certificado'] || null;
    } catch { perms = null; }

    // Fallback legacy: admin/gerente pueden borrar certs de su sector
    const empRole = norm(employee.role);
    const legacyDelete = ['admin', 'gerente', 'gerente_general', 'gerencia', 'administrativo'].includes(empRole);
    const canDelete = (perms && perms.delete === true) || (perms && perms.delete === false ? false : legacyDelete);

    if (!canDelete) {
      return Response.json({ error: 'No tenés permiso para eliminar este certificado' }, { status: 403 });
    }

    // Verificar ownership: el caller debe ser el creador, aprobador, o tener
    // admin_view. Esto evita que un jefe borre certs de otros jefes aunque
    // tenga delete=true (a menos que tenga admin_view).
    const isAdminView = await resolveAdminView(sb, employee, 'Certificado');
    if (!isAdminView) {
      const sols = await sb.entities.SolicitudCertificado.filter({ certificado_id }).catch(() => []);
      if (!certVisibleToUser(cert, user, callerSector, sols || [])) {
        return Response.json({ error: 'Solo podés eliminar certificados que creaste' }, { status: 403 });
      }
    }

    // Borrar solicitud vinculada si existe (cleanup)
    const sols = await sb.entities.SolicitudCertificado.filter({ certificado_id }).catch(() => []);
    for (const s of (sols || [])) {
      await sb.entities.SolicitudCertificado.delete(s.id).catch(() => {});
    }

    await sb.entities.Certificado.delete(certificado_id);
    return Response.json({ success: true, mensaje: 'Certificado eliminado correctamente' });
  } catch (error) {
    return Response.json({ error: error.message || 'Error al eliminar el certificado' }, { status: 500 });
  }
}