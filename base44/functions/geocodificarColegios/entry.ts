import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function geocode(address) {
  const query = encodeURIComponent(`${address}, Ciudad Autónoma de Buenos Aires, Argentina`);
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=ar`,
    { headers: { 'Accept-Language': 'es', 'User-Agent': 'DH1-Software/1.0' } }
  );
  const data = await res.json();
  if (data.length > 0) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  return null;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // Obtener LocationData sin coords
  const locations = await base44.asServiceRole.entities.LocationData.list('-created_date', 500);
  const direcciones = await base44.asServiceRole.entities.Direccion.list('-created_date', 500);

  const dirMap = {};
  direcciones.forEach(d => { dirMap[d.id] = d; });

  const pending = locations.filter(l =>
    !l.gps_latitude && l.direccion_id && dirMap[l.direccion_id]?.direccion
  );

  if (pending.length === 0) {
    return Response.json({ updated: 0, total: 0, message: 'Todos los colegios ya tienen coordenadas' });
  }

  // Agrupar por dirección para evitar geocodificar la misma dirección múltiples veces
  const dirCache = {};
  let updated = 0;
  let failed = 0;

  for (const loc of pending) {
    const dir = dirMap[loc.direccion_id];
    const addressKey = dir.direccion;

    let coords = dirCache[addressKey];
    if (!coords) {
      coords = await geocode(addressKey);
      dirCache[addressKey] = coords || null;
      await sleep(1100); // Nominatim rate limit: 1 req/s
    }

    if (coords) {
      await base44.asServiceRole.entities.LocationData.update(loc.id, {
        gps_latitude: coords.lat,
        gps_longitude: coords.lon,
      });
      updated++;
    } else {
      failed++;
    }
  }

  return Response.json({
    updated,
    failed,
    total: pending.length,
    message: `Geocodificados ${updated} de ${pending.length} colegios`,
  });
});