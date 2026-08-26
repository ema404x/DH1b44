import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { eliminarJefeSitio } from '../../shared/eliminarJefeSitio.ts';

/**
 * POST /functions/eliminarJefeSitio
 *
 * Elimina un Jefe de Sitio del módulo Empleados y hereda sus OT (y demás
 * registros) al responsable ACTUAL de cada ubicación según Información
 * General (fuente de verdad). Ambos sectores, aislado. Fail-closed: si una
 * ubicación no fue reasignada en IG, su registro se reporta y no se toca.
 *
 * Body:
 *   empleado_id?     — ID del Employee a eliminar (preferido)
 *   jefe_saliente?   — nombre (si no hay empleado_id)
 *   jefe_entrante?   — override explícito (modo manual; si se omite, deriva por ubicación)
 *   dry_run?         — true → simula sin escribir/eliminar
 *
 * Requiere admin o gerente del sector.
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = (user.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'gerente') {
      return Response.json({ error: 'Solo admin o gerente pueden eliminar y reasignar jefes.' }, { status: 403 });
    }

    const sector_id = user?.data?.sector_id || user?.sector_id;
    if (!sector_id) return Response.json({ error: 'Sin sector asignado' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const dry_run = body?.dry_run === true;

    const result = await eliminarJefeSitio({
      sb: base44.asServiceRole,
      sector_id,
      empleado_id: body?.empleado_id,
      jefe_saliente: body?.jefe_saliente,
      jefe_entrante: body?.jefe_entrante,
      dry_run,
      actor: { email: user.email, role: user.role },
    });

    return Response.json({ success: true, ...result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}