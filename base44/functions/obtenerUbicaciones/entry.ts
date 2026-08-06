import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * obtenerUbicaciones — devuelve LocationData, Direccion y LocationQR
 * scopeadas al SECTOR del usuario autenticado, usando service role.
 *
 * Fail CLOSED: si el caller no tiene sector_id, se devuelve listado vacío
 * (nunca "todo"). El join LocationData ↔ Direccion se hace server-side.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    // Validar que el usuario esté autenticado
    const isAuth = await base44.auth.isAuthenticated();
    if (!isAuth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolver el sector del caller y FAIL CLOSED si no tiene
    const me = await base44.auth.me();
    const callerSector = me?.data?.sector_id || me?.sector_id;
    if (!callerSector) {
      return Response.json({ locations: [], direcciones: [], locationQRs: [], total: 0 });
    }

    const sb = base44.asServiceRole;

    // Fetch en paralelo, FILTRADO por sector del caller
    const [locationData, direcciones, locationQRs] = await Promise.all([
      sb.entities.LocationData.filter({ sector_id: callerSector }, '-created_date', 5000),
      sb.entities.Direccion.filter({ sector_id: callerSector }, '-direccion', 5000),
      sb.entities.LocationQR.filter({ sector_id: callerSector }, 'name', 5000),
    ]);

    // Indexar direcciones por id para el join O(1)
    const dirMap = new Map();
    for (const d of direcciones) {
      dirMap.set(d.id, d);
    }

    // Indexar QRs por nombre normalizado para lookup rápido
    const norm = (s) => (s || '').toLowerCase().trim();
    const qrByName = new Map();
    const qrByAddress = new Map();
    const qrByUbic = new Map();
    for (const q of locationQRs) {
      if (q.name) qrByName.set(norm(q.name), q);
      if (q.address) qrByAddress.set(norm(q.address), q);
    }

    // Join: cada LocationData obtiene su dirección real y su QR id
    const locations = locationData.map(ld => {
      const dir = ld.direccion_id ? dirMap.get(ld.direccion_id) : null;
      const address = dir?.direccion || '';
      const qr =
        qrByName.get(norm(ld.establecimiento)) ||
        qrByAddress.get(norm(address)) ||
        qrByName.get(norm(ld.ubic_tecnica)) ||
        null;

      return {
        id: ld.id,
        ubic_tecnica: ld.ubic_tecnica || '',
        elem_pep: ld.elem_pep || '',
        establecimiento: ld.establecimiento || '',
        m2: ld.m2 || 0,
        comuna: ld.comuna || dir?.comuna || '',
        direccion_id: ld.direccion_id || '',
        direccion: address,
        jefe_sitio: ld.jefe_sitio || dir?.jefe_sitio || '',
        inspector: ld.inspector || dir?.inspector || '',
        estado: ld.estado || 'activo',
        gps_latitude: ld.gps_latitude || null,
        gps_longitude: ld.gps_longitude || null,
        sector_id: ld.sector_id || '',
        location_qr_id: qr?.id || '',
        location_qr_name: qr?.name || '',
        project_name: qr?.project_name || '',
        _hasQR: !!qr,
      };
    });

    return Response.json({
      locations,
      direcciones,
      locationQRs,
      total: locations.length,
    });
  } catch (error) {
    console.error('[obtenerUbicaciones] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}