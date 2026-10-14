import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { createScopedClient, sectorErrorResponse } from '../../shared/sectorGuard.ts';
import { resolveCallerSectorCanonical } from '../../shared/callerIdentity.ts';

/**
 * Archivado automático de OTs al Historial.
 *
 * REGLA DE ORO: una OT que pasó a 'completada' se archiva a los 30 días
 * (calendar, huso Argentina). Al archivar NO se cambia status (sigue
 * 'completada') — se marca archivada=true + fecha_archivado. Las vistas
 * activas (Kanban/Grilla/Stats) ocultan las archivadas; el Historial las
 * muestra para visualización normal.
 *
 * Procesa únicamente el sector canónico del administrador autenticado.
 * Nunca admite un encabezado o un sector del payload como autorización
 * para operar otro sector. Los registros sin sector se excluyen.
 *
 * Fail-safes:
 *  - Sólo archiva completadas con completed_date <= cutoff (hoy-30d).
 *  - Sólo archiva las que NO están archivadas ya (idempotente ante retries).
 *  - Sin completed_date → no archiva (no tiene de qué contar 30 días).
 *  - Auditoría con resumen por sector.
 *
 * Disparador: automatización scheduled diaria (02:00).
 */
const AR_OFFSET_MS = -3 * 60 * 60 * 1000; // UTC-3 (Argentina, sin DST)
function arDateStr(d: Date): string {
  return new Date(d.getTime() + AR_OFFSET_MS).toISOString().split('T')[0];
}



export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const { sector } = await resolveCallerSectorCanonical(base44.asServiceRole, user);
    const sb = createScopedClient(base44, sector);
    const body = await req.json().catch(() => ({}));
    if (body.sector_id && body.sector_id !== sector) return Response.json({ error: 'Sector distinto del activo' }, { status: 403 });
    const now = new Date();
    const cutoff = arDateStr(new Date(now.getTime() - 30 * 86400000));
    const query = { status: 'completada', archivada: { $ne: true }, completed_date: { $gte: '0001-01-01', $lte: cutoff } };
    const total = await sb.entities.WorkOrder.count(query);
    if (body.dry_run === true) return Response.json({ success: true, dry_run: true, sector, candidatas: total, cutoff });
    if (total) {
      let result;
      do {
        result = await sb.entities.WorkOrder.updateMany(query, { $set: { archivada: true, fecha_archivado: now.toISOString() } });
      } while (result.has_more);
    }
    const archivadas = Math.max(0, total - await sb.entities.WorkOrder.count(query));
    if (archivadas) {
      await sb.entities.AuditLog.create({
        entity_type: 'WorkOrder', entity_id: `sector:${sector}`, action: 'update',
        user_email: user.email, user_role: user.role, timestamp: now.toISOString(),
        changed_fields: ['archivada', 'fecha_archivado'],
        notes: `Archivado del sector ${sector}: ${archivadas} OTs (cutoff ${cutoff}).`,
      });
    }
    return Response.json({ success: true, sector, archivadas, cutoff, porSector: { [sector]: archivadas } });
  } catch (e) {
    return sectorErrorResponse(e);
  }
}