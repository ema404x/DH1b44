import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getVisibleWorkOrders } from "../../shared/workOrderVisibility.ts";

/**
 * Devuelve las OTs que el usuario actual puede ver.
 *
 * Orquestador DELGADO: toda la lógica de visibilidad vive en
 * base44/shared/workOrderVisibility.ts (REGLA DE ORO de visibilidad de OTs).
 * Esta función sólo resuelve el cliente, delega, y mapea el resultado a la
 * response contract { orders, total, role }.
 *
 * La regla de oro es sector-agnóstica (escuela y bapro idénticos),
 * determinística (fetchAll sin saltos) y fail-closed (OT sin sector_id se
 * excluye en vez de atribuirse a un default). Ver el módulo compartido para
 * el detalle de las reglas y fail-safes.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    // includeArchived: el tablero (sin param) recibe solo activas + archived_count
    // para el header. El Historial pasa includeArchived:true → recibe todas las
    // visibles (activas + archivadas) para la pestaña Archivadas y su badge.
    // scope='own': el Dashboard pide solo las OTs propias del usuario (ignora
    // admin-view y linkage jefe) para que el feed y los KPIs reflejen "siempre
    // del usuario actual" sin importar el rol.
    const includeArchived = body?.includeArchived === true;
    const forceOwnOnly = body?.scope === 'own';
    const { orders, total, archived_count, role, ctx } = await getVisibleWorkOrders(
      base44.asServiceRole, user, { excludeArchived: !includeArchived, forceOwnOnly }
    );

    if (!ctx) return Response.json({ error: 'Sin sector asignado' }, { status: 403 });

    // archived_count va siempre (incluso cuando excludeArchived=true) para que el
    // header del tablero muestre "X activas · Y archivadas" sin un fetch extra.
    return Response.json({ orders, total, archived_count, role, ctx });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}