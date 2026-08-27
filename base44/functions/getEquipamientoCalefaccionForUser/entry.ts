import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { resolveAndReconcileSector } from '../../shared/callerIdentity.ts';
import { fetchAll } from '../../shared/fetchAllSector.ts';
import { resolveAdminView, resolveEstablecimientosDeJefe, norm } from '../../shared/visibilityResolver.ts';

/**
 * Devuelve los equipos de calefacción que el usuario actual puede ver.
 * ÚNICA fuente de verdad de visibilidad para el módulo Calefacción.
 *
 * - Con admin_view (Ver Todo) para Calefaccion: todo el sector.
 * - Sin admin_view: equipos donde es jefe_sitio (por nombre) + los de
 *   escuelas donde es jefe asignado (cruce contra Direccion/Asset.jefe_sitio).
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const sb = base44.asServiceRole;

    const { sector, employee } = await resolveAndReconcileSector(sb, user);
    if (!sector) return Response.json({ error: 'Sin sector asignado' }, { status: 403 });

    const displayName = employee?.full_name || user.full_name || '';

    const all = await fetchAll(sb, 'EquipamientoCalefaccion', { sector_id: sector });
    const adminView = await resolveAdminView(sb, employee, 'Calefaccion');

    if (adminView) {
      return Response.json({ equipos: all, total: all.length, admin_view: true });
    }

    const establecimientos = await resolveEstablecimientosDeJefe(sb, sector, displayName);
    const visibles = all.filter(r =>
      (r.jefe_sitio && norm(r.jefe_sitio) === norm(displayName)) ||
      (r.escuela && establecimientos.has(norm(r.escuela)))
    );

    return Response.json({ equipos: visibles, total: visibles.length, admin_view: false });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}