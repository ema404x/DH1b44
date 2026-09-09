import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { resolveAndReconcileSector } from '../../shared/callerIdentity.ts';
import { fetchAll } from '../../shared/fetchAllSector.ts';
import { resolveAdminView, norm } from '../../shared/visibilityResolver.ts';

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
 *
 * OPTIMIZACIÓN: 4 fetchAll en paralelo (InspeccionColegio, Direccion,
 * LocationData, Asset) — sin duplicados. El set de establecimientos asignados
 * se calcula inline a partir de los arrays ya fetched, evitando las llamadas
 * recursivas a resolveEstablecimientosDeJefe que re-fetchaban Direccion+Asset.
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
    const targetName = norm(displayName);
    const targetEmail = employeeEmail ? norm(employeeEmail) : '';

    // 4 fetchAll en paralelo — sin duplicados. RolePermission cache hit en
    // resolveAdminView si ya se cargó en este cold-start.
    const [allInspecciones, direcciones, allLocations, allAssets] = await Promise.all([
      fetchAll(sb, 'InspeccionColegio', { sector_id: sector }),
      fetchAll(sb, 'Direccion', { sector_id: sector }),
      fetchAll(sb, 'LocationData', { sector_id: sector }),
      fetchAll(sb, 'Asset', { sector_id: sector }),
    ]);

    const adminView = await resolveAdminView(sb, employee, 'InspeccionColegio');

    // Predicado de matcheo de jefe (nombre o email normalizado).
    const matchJefe = (jefeStr: string | null | undefined): boolean => {
      if (!jefeStr) return false;
      const n = norm(jefeStr);
      if (targetName && n === targetName) return true;
      if (targetEmail && n === targetEmail) return true;
      return false;
    };

    // Set de establecimientos asignados al jefe (cruce contra Direccion +
    // Asset ya fetched). Para admin no hace falta — ve todo el sector.
    let establecimientos: any[];
    let inspecciones: any[];

    if (adminView) {
      establecimientos = allLocations || [];
      inspecciones = allInspecciones || [];
    } else {
      // Calcular estabsSet una sola vez a partir de los arrays ya fetched.
      const estabsSet = new Set<string>();
      (direcciones || []).forEach((d: any) => {
        if (matchJefe(d.jefe_sitio) && d.direccion) estabsSet.add(norm(d.direccion));
      });
      (allAssets || []).forEach((a: any) => {
        if (matchJefe(a.jefe_sitio)) {
          if (a.sede) estabsSet.add(norm(a.sede));
          if (a.location) estabsSet.add(norm(a.location));
        }
      });

      // LocationData visibles: jefe_sitio asignado (name/email) o
      // establecimiento en el set de direcciones asignadas.
      establecimientos = (allLocations || []).filter((l: any) => {
        const jefeStr = l.jefe_sitio ? norm(l.jefe_sitio) : '';
        if (targetName && jefeStr === targetName) return true;
        if (targetEmail && jefeStr === targetEmail) return true;
        if (l.establecimiento && estabsSet.has(norm(l.establecimiento))) return true;
        return false;
      });

      // Inspecciones visibles: creadas + jefe_sitio por nombre + establecimiento asignado.
      inspecciones = (allInspecciones || []).filter((r: any) =>
        (r.created_by_id && r.created_by_id === userId) ||
        (r.jefe_sitio && norm(r.jefe_sitio) === targetName) ||
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