import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { reasignarJefeSitio } from '../../shared/reasignarJefeSitio.ts';

/**
 * reasignarJefeSitio — Reasigna TODO lo de un jefe de sitio saliente al
 * entrante que se queda con la ubicación, y desactiva al saliente.
 *
 * Regla de oro: base44/shared/reasignarJefeSitio.ts (aislada por sector,
 * match dual email/nombre, preserva RLS estampando el email del entrante,
 * no borra al empleado — lo desactiva, audita, y soporta dry_run).
 *
 * Permisos: admin o gerente. Sólo opera en el sector del caller.
 *
 * Body:
 *   jefe_saliente: { employee_id?, email?, nombre? }
 *   jefe_entrante: { employee_id?, email?, nombre? }
 *   sector_id?: string  // opcional; default = user.data.sector_id
 *   dry_run?: boolean    // true = simula sin escribir
 */
export default async function (req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'gerente'].includes(user.role)) {
    return Response.json({ error: 'Permisos insuficientes (solo admin o gerente).' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  if (!body?.jefe_saliente || !body?.jefe_entrante) {
    return Response.json({ error: 'Falta jefe_saliente o jefe_entrante.' }, { status: 400 });
  }

  const sector_id = body.sector_id || user.data?.sector_id;
  if (!sector_id) {
    return Response.json({ error: 'No se pudo determinar el sector del caller.' }, { status: 400 });
  }

  try {
    const result = await reasignarJefeSitio({
      sb: base44.asServiceRole,
      sector_id,
      saliente: body.jefe_saliente,
      entrante: body.jefe_entrante,
      dry_run: !!body.dry_run,
      actor: { email: user.email, role: user.role },
    });
    return Response.json({ success: true, ...result });
  } catch (e) {
    return Response.json({ error: e.message || 'Error en la reasignación.' }, { status: 400 });
  }
}