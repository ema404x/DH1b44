import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * obtenerUbicaciones — devuelve todas las LocationData, Direccion y LocationQR
 * usando service role (sin RLS), para que TODOS los usuarios vean el listado
 * completo de direcciones sin depender de su sector_id o rol.
 *
 * Realiza el join LocationData ↔ Direccion via direccion_id server-side,
 * devolviendo cada LocationData con su dirección real resuelta.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    // Validar que el usuario esté autenticado
    const isAuth = await base44.auth.isAuthenticated();
    if (!isAuth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sb = base44.asServiceRole;

    // Fetch en paralelo: LocationData, Direccion y LocationQR
    const [locationData, direcciones, locationQRs] = await Promise.all([
      sb.entities.LocationData.list('-created_date', 5000),
      sb.entities.Direccion.list('-direccion', 5000),
      sb.entities.LocationQR.list('name', 5000),
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
        sector_id: ld.sector_id || 'escuela',
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