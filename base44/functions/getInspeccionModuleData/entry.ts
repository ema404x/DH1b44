import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { resolveAndReconcileSector } from '../../shared/callerIdentity.ts';
import { fetchAll } from '../../shared/fetchAllSector.ts';
import {
  resolveAdminView,
  resolveEstablecimientosDeJefe,
  resolveEstablecimientosLocationData,
  norm,
} from '../../shared/visibilityResolver.ts';

/**
 * Devuelve TODO lo que el módulo de Inspección de Colegios necesita en una
 * sola respuesta: inspecciones visibles + establecimientos (LocationData) del
 * jefe + direcciones del sector.
 *
 * Esto elimina la race condition del cliente: antes, el dropdown de colegios
 * venía de LocationData.list (SDK directo, RLS lee user.data.sector_id que
 * puede estar desfasado). Ahora el backend reconcilia el sector primero y
 * devuelve todo en un único payload.
 *
 * - Con admin_view: todas las inspecciones + todos los establecimientos +
 *   todas las direcciones del sector.
 * - Sin admin_view: inspecciones visibles (created_by + jefe_sitio + estabs
 *   asignados) + solo los establecimientos donde es jefe asignado.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const sb = base44.asServiceRole;

    const { sector, employee } = await resolveAndReconcileSector(sb, user);
    if (!sector) return Response.json({ error: 'Sin sector asignado' }, { status: 403 });

    const userId = user.id;
    const displayName = employee?.full_name || user.full_name || '';
    const employeeEmail = employee?.email || user.email || '';

    // FetchAll de inspecciones + direcciones en paralelo (role cache hit en
    // resolveAdminView si ya se cargó en este cold-start).
    const [allInspecciones, direcciones] = await Promise.all([
      fetchAll(sb, 'InspeccionColegio', { sector_id: sector }),
      fetchAll(sb, 'Direccion', { sector_id: sector }),
    ]);

    const adminView = await resolveAdminView(sb, employee, 'InspeccionColegio');

    // Establecimientos (LocationData) visibles para el caller.
    const establecimientos = await resolveEstablecimientosLocationData(
      sb, sector, displayName, employeeEmail, adminView,
    );

    // Filtrar inspecciones visibles.
    let inspecciones;
    if (adminView) {
      inspecciones = allInspecciones;
    } else {
      const estabsSet = await resolveEstablecimientosDeJefe(sb, sector, displayName, employeeEmail || undefined);
      inspecciones = (allInspecciones || []).filter(r =>
        (r.created_by_id && r.created_by_id === userId) ||
        (r.jefe_sitio && norm(r.jefe_sitio) === norm(displayName)) ||
        (r.establecimiento && estabsSet.has(norm(r.establecimiento)))
      );
    }

    return Response.json({
      inspecciones,
      establecimientos,
      direcciones,
      admin_view: adminView,
      sector,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}