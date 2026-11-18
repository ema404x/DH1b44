import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildOtVisibilityContext, otEsVisiblePara } from "../../shared/workOrderVisibility.ts";

/**
 * Órdenes rápidas (beta) — versión liviana de getWorkOrdersForUser.
 *
 * Usa la MISMA regla de oro de visibilidad (buildOtVisibilityContext +
 * otEsVisiblePara del módulo compartido) y los mismos parámetros
 * (includeArchived, scope). Solo cambia lo que devuelve:
 *
 *  - { fields: 'board' }              → todas las OT visibles con los campos
 *                                       de tablero.
 *  - { fields: 'board', since: ISO }  → solo las OT visibles modificadas
 *                                       después de `since` (changed) + la
 *                                       lista completa de ids visibles (ids).
 *  - { id }                           → la OT COMPLETA, si es visible para el
 *                                       usuario (para detalle / edición).
 *
 * Siempre devuelve server_time y next_since (hora del servidor con un margen
 * de seguridad, para usar como próximo since sin perder cambios).
 */
const BOARD_FIELDS = [
  'id', 'created_date', 'updated_date', 'created_by_id',
  'title', 'code', 'status', 'priority', 'type', 'archivada',
  'location', 'location_qr_id', 'location_qr_name', 'project_name', 'asset_name',
  'assigned_to', 'assigned_name', 'jefe_sitio', 'jefe_sitio_email',
  'scheduled_date', 'sector_id',
];
const LIMIT = 5000;               // mismo techo que fetchAll
const SINCE_MARGIN_MS = 2 * 60 * 1000;

// updated_date viene en UTC sin sufijo de zona.
const toMs = (v) => {
  if (!v) return NaN;
  const s = String(v);
  return new Date(/([zZ]|[+-]\d\d:?\d\d)$/.test(s) ? s : s + 'Z').getTime();
};

const pick = (o) => {
  const r = {};
  for (const f of BOARD_FIELDS) if (o[f] !== undefined) r[f] = o[f];
  return r;
};

export default async function(req) {
  try {
    const startedAt = Date.now();
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const sb = base44.asServiceRole;

    // ── OT completa por id ──
    if (body?.id) {
      const ctx = await buildOtVisibilityContext(sb, user);
      if (!ctx) return Response.json({ error: 'Sin sector asignado' }, { status: 403 });
      const ot = await sb.entities.WorkOrder.get(String(body.id))
        .catch((e) => (e.status === 404 ? null : Promise.reject(e)));
      if (!ot || !otEsVisiblePara(ot, ctx)) {
        return Response.json({ error: 'Orden no encontrada' }, { status: 404 });
      }
      return Response.json({ order: ot });
    }

    if (body?.fields !== undefined && body.fields !== 'board') {
      return Response.json({ error: "fields debe ser 'board'" }, { status: 400 });
    }
    let sinceMs = null;
    if (body?.since) {
      sinceMs = toMs(body.since);
      if (Number.isNaN(sinceMs)) return Response.json({ error: 'since inválido' }, { status: 400 });
    }

    const includeArchived = body?.includeArchived === true;
    const forceOwnOnly = body?.scope === 'own';

    const ctx = await buildOtVisibilityContext(sb, user, { forceOwnOnly });
    if (!ctx) return Response.json({ error: 'Sin sector asignado' }, { status: 403 });

    // Mismo set que getVisibleWorkOrders (sector + -updated_date), pidiendo a
    // la base solo los campos de tablero (incluyen todos los que lee el
    // predicado de visibilidad).
    const all = await sb.entities.WorkOrder.filter({ sector_id: ctx.sector }, '-updated_date', LIMIT, 0, BOARD_FIELDS);
    if (!Array.isArray(all)) throw new Error('Respuesta inválida al cargar las órdenes.');

    const allVisible = all.filter((ot) => otEsVisiblePara(ot, ctx));
    const archivadas = allVisible.filter((o) => o.archivada);
    const activas = allVisible.filter((o) => !o.archivada);
    const orders = includeArchived ? allVisible : activas;

    const base = {
      total: orders.length,
      archived_count: archivadas.length,
      role: ctx.isAdminView ? 'admin' : ctx.employeeRole || 'user',
      ctx,
      board_fields: BOARD_FIELDS,
      server_time: new Date(startedAt).toISOString(),
      next_since: new Date(startedAt - SINCE_MARGIN_MS).toISOString(),
    };

    if (sinceMs === null) {
      return Response.json({ ...base, orders: orders.map(pick) });
    }

    // Fecha ilegible → se envía igual (nunca se pierde un cambio).
    const changed = orders.filter((o) => !(toMs(o.updated_date) <= sinceMs)).map(pick);
    return Response.json({ ...base, changed, ids: orders.map((o) => o.id) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}