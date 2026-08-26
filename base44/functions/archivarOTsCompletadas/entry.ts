import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

/**
 * Archivado automático de OTs al Historial.
 *
 * REGLA DE ORO: una OT que pasó a 'completada' se archiva a los 30 días
 * (calendar, huso Argentina). Al archivar NO se cambia status (sigue
 * 'completada') — se marca archivada=true + fecha_archivado. Las vistas
 * activas (Kanban/Grilla/Stats) ocultan las archivadas; el Historial las
 * muestra para visualización normal.
 *
 * Aplica a AMBOS sectores (escuela y bapro) de forma idéntica: corre como
 * service role, no filtra por sector — procesa todas las completadas del
 * sistema. El aislamiento se preserva en la visualización (cada sector ve
 * sus propias archivadas vía RLS).
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

async function fetchAll(sb: any, entity: string, query: Record<string, any>, sort = 'created_date'): Promise<any[]> {
  const all: any[] = [];
  let cursor: string | undefined;
  let prev: string | undefined;
  for (let i = 0; i < 200; i++) {
    let batch: any[];
    try {
      const q = { ...query };
      if (cursor) q.created_date = { $gt: cursor };
      batch = await sb.entities[entity].filter(q, sort, 500);
    } catch { break; }
    all.push(...batch);
    if (batch.length < 500) break;
    cursor = batch[batch.length - 1]?.created_date;
    if (!cursor || cursor === prev) break;
    prev = cursor;
  }
  return all;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const sb = base44.asServiceRole;
    const now = new Date();
    const cutoff = arDateStr(new Date(now.getTime() - 30 * 86400000));

    // Todas las completadas del sistema (ambos sectores). Paginado.
    const candidatas = await fetchAll(sb, 'WorkOrder', { status: 'completada' }, 'completed_date');

    // Filtrado idempotente: no archivadas + completed_date <= cutoff.
    const aArchivar = candidatas.filter((o) => !o.archivada && o.completed_date && o.completed_date <= cutoff);

    let archivadas = 0;
    const porSector: Record<string, number> = {};
    const updates = aArchivar.map((o) => {
      archivadas++;
      const s = o.sector_id || 'sin_sector';
      porSector[s] = (porSector[s] || 0) + 1;
      return { id: o.id, archivada: true, fecha_archivado: now.toISOString() };
    });

    for (let i = 0; i < updates.length; i += 500) {
      await sb.entities.WorkOrder.bulkUpdate(updates.slice(i, i + 500));
    }

    // Auditoría
    if (archivadas > 0) {
      try {
        await sb.entities.AuditLog.create({
          entity_type: 'WorkOrder',
          action: 'update',
          user_email: 'automacion',
          user_role: 'sistema',
          timestamp: now.toISOString(),
          changed_fields: ['archivada', 'fecha_archivado'],
          notes: `Archivado automático de OTs completadas (cutoff ${cutoff}): ${archivadas} OTs. Por sector: ${JSON.stringify(porSector)}`,
        });
      } catch { /* best-effort */ }
    }

    return Response.json({ success: true, archivadas, cutoff, porSector });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}