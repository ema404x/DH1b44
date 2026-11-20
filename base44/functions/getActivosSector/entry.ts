import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { seesAllAssets, assetMatchKeys, assetIsMine, crearResolverJefe } from '../../shared/assetVisibility.ts';
import { buildOtVisibilityContext, otEsVisiblePara } from '../../shared/workOrderVisibility.ts';

// Activos del sector del caller, filtrados por la regla de base44/shared/assetVisibility.ts.
//
// - Sin asset_id: devuelve la lista visible (admin/gerente: todo el sector; resto:
//   solo los activos de su jefe de sitio). Alimenta Activos, CrearOT y ProponerOT.
// - Con asset_id: devuelve ese activo si es visible, o si figura en alguna OT
//   que el caller puede ver. Si no, 403. Alimenta la ficha ActivoFicha.
//
// Service role (sin RLS), con aislamiento por sector_id = sector del caller.

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const assetId = body?.asset_id || null;

    // Sector canónico: la ficha de Empleado es la fuente de verdad (igual que
    // getOperariosSector / eliminarOT). user.data como fallback.
    const userEmail = (user.email || '').toLowerCase().trim();
    let employee = null;
    if (userEmail) {
      const empResults = await base44.asServiceRole.entities.Employee.filter({ email: userEmail });
      employee = empResults[0] || null;
    }
    if (!employee && user.id) {
      const empByUserId = await base44.asServiceRole.entities.Employee.filter({ user_id: user.id });
      employee = empByUserId[0] || null;
    }
    const callerSector = employee?.sector_id || user.data?.sector_id || user.sector_id;
    if (!callerSector) {
      return Response.json({ error: 'Sin sector asignado' }, { status: 403 });
    }

    const seesAll = seesAllAssets(user);
    const keys = assetMatchKeys(employee, user);
    // Jefe del colegio/dirección: solo hace falta si el caller no ve todo.
    const jefeDe = seesAll
      ? () => ''
      : crearResolverJefe(...(await Promise.all([
          base44.asServiceRole.entities.LocationData.filter({ sector_id: callerSector }, '-created_date', 5000),
          base44.asServiceRole.entities.Direccion.filter({ sector_id: callerSector }, '-direccion', 5000),
        ])));

    if (assetId) {
      const asset = await base44.asServiceRole.entities.Asset.get(assetId)
        .catch((e) => (e.status === 404 ? null : Promise.reject(e)));
      if (!asset || asset.sector_id !== callerSector) {
        return Response.json({ error: 'Activo no encontrado' }, { status: 404 });
      }
      if (seesAll || assetIsMine(asset, keys, jefeDe)) return Response.json({ asset });

      // ¿Figura en alguna OT que el caller puede ver?
      const ctx = await buildOtVisibilityContext(base44.asServiceRole, user);
      if (ctx) {
        const [byId, byName] = await Promise.all([
          base44.asServiceRole.entities.WorkOrder.filter({ sector_id: callerSector, asset_id: asset.id }, '-updated_date', 500),
          asset.name
            ? base44.asServiceRole.entities.WorkOrder.filter({ sector_id: callerSector, asset_name: asset.name }, '-updated_date', 500)
            : Promise.resolve([]),
        ]);
        if ([...byId, ...byName].some((ot) => otEsVisiblePara(ot, ctx))) {
          return Response.json({ asset });
        }
      }
      return Response.json({ error: 'No tenés acceso a este activo.' }, { status: 403 });
    }

    // Lista: mismo orden (-name) que usaba CrearOT con Asset.list.
    const all = await base44.asServiceRole.entities.Asset.list('-name', 1000);
    const inSector = all.filter((a) => a.sector_id === callerSector);
    const assets = seesAll ? inSector : inSector.filter((a) => assetIsMine(a, keys, jefeDe));

    return Response.json({
      assets,
      sector: callerSector,
      total: assets.length,
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}