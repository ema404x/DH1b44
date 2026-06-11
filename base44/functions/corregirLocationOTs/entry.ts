import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Solo administradores' }, { status: 403 });
    }

    // Cargar todos los datos necesarios en paralelo
    const [allOTs, locationQRs, direcciones, locationData] = await Promise.all([
      base44.asServiceRole.entities.WorkOrder.list('created_date', 5000),
      base44.asServiceRole.entities.LocationQR.list('name', 2000),
      base44.asServiceRole.entities.Direccion.list('direccion', 2000),
      base44.asServiceRole.entities.LocationData.list('establecimiento', 2000),
    ]);

    // Índices para búsqueda rápida
    const qrById = {};
    locationQRs.forEach(q => { qrById[q.id] = q; });

    const findJefeSitio = (address, name) => {
      const addr = (address || '').toLowerCase().trim();
      const nm   = (name   || '').toLowerCase().trim();

      // 1. Buscar en Direccion por dirección
      const dirMatch = direcciones.find(d =>
        (addr && d.direccion?.toLowerCase().trim() === addr) ||
        (nm   && d.direccion?.toLowerCase().trim() === nm)
      );
      if (dirMatch?.jefe_sitio) return dirMatch.jefe_sitio;

      // 2. Fallback: LocationData
      const ldMatch = locationData.find(ld =>
        (nm   && ld.establecimiento?.toLowerCase().trim() === nm) ||
        (addr && ld.establecimiento?.toLowerCase().trim() === addr) ||
        (addr && ld.direccion?.toLowerCase().trim() === addr)
      );
      return ldMatch?.jefe_sitio || '';
    };

    // OTs que tienen location_qr_id pero location vacío
    const toFix = allOTs.filter(ot =>
      ot.location_qr_id &&
      ot.location_qr_id !== '' &&
      (!ot.location || ot.location.trim() === '')
    );

    let fixed = 0;
    let skipped = 0;

    const BATCH = 10;
    for (let i = 0; i < toFix.length; i += BATCH) {
      const batch = toFix.slice(i, i + BATCH);
      await Promise.allSettled(batch.map(async (ot) => {
        const qr = qrById[ot.location_qr_id];
        if (!qr) { skipped++; return; }

        const address    = qr.address?.trim() || '';
        const name       = qr.name?.trim()    || '';
        const location   = address ? `${address}, CABA` : name;
        const jefeSitio  = findJefeSitio(address, name);

        const updates = {
          location:        location,
          location_qr_name: name,
        };
        if (jefeSitio) updates.assigned_name = jefeSitio;

        await base44.asServiceRole.entities.WorkOrder.update(ot.id, updates);
        fixed++;
      }));
    }

    return Response.json({
      total_revisadas: allOTs.length,
      a_corregir: toFix.length,
      corregidas: fixed,
      sin_qr_valido: skipped,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});