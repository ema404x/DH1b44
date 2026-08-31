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

    const { orders, total, role, ctx } = await getVisibleWorkOrders(base44.asServiceRole, user);

    if (!ctx) return Response.json({ error: 'Sin sector asignado' }, { status: 403 });

    return Response.json({ orders, total, role });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}