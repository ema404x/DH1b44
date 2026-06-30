import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo admin puede ejecutar reconciliación' }, { status: 403 });

    const norm = (s) => (s || '').toLowerCase().trim();

    // Cargar todas las fuentes
    const [locationData, locationQRs, direcciones] = await Promise.all([
      base44.asServiceRole.entities.LocationData.list('establecimiento', 5000),
      base44.asServiceRole.entities.LocationQR.list('name', 5000),
      base44.asServiceRole.entities.Direccion.list('direccion', 5000),
    ]);

    // Nombres ya existentes en LocationData
    const ldNames = new Set();
    for (const ld of locationData) {
      if (ld.establecimiento) ldNames.add(norm(ld.establecimiento));
      if (ld.ubic_tecnica) ldNames.add(norm(ld.ubic_tecnica));
    }

    // Lookups por nombre normalizado
    const dirMap = new Map();
    for (const d of direcciones) dirMap.set(norm(d.direccion), d);

    const qrMap = new Map();
    for (const q of locationQRs) qrMap.set(norm(q.name), q);

    const toCreate = [];
    let fromDireccion = 0;
    let qrSkipped = 0;
    const qrSkippedList = [];

    // PASO 1: Direccion → LocationData (crear registros faltantes)
    for (const d of direcciones) {
      const key = norm(d.direccion);
      if (ldNames.has(key)) continue;

      // Enriquecer con GPS del QR si coincide
      const qr = qrMap.get(key);

      const record = {
        establecimiento: d.direccion,
        comuna: d.comuna || '8A',
        jefe_sitio: d.jefe_sitio || '',
        inspector: d.inspector || '',
        m2: d.m2 || 0,
        direccion_id: d.id,
        estado: d.estado || 'activo',
        ubic_tecnica: '',
      };
      if (qr && qr.latitude && qr.longitude) {
        record.gps_latitude = qr.latitude;
        record.gps_longitude = qr.longitude;
      }
      toCreate.push(record);
      ldNames.add(key);
      fromDireccion++;
    }

    // PASO 2: LocationQR sin Direccion ni LocationData
    // No se pueden crear sin comuna (campo required con enum) — se reportan para revisión manual
    for (const q of locationQRs) {
      const key = norm(q.name);
      if (ldNames.has(key)) continue;
      if (dirMap.has(key)) continue;
      qrSkippedList.push({ name: q.name, address: q.address });
      qrSkipped++;
    }

    // Crear en lote
    let creados = [];
    if (toCreate.length > 0) {
      creados = await base44.asServiceRole.entities.LocationData.bulkCreate(toCreate);
    }

    return Response.json({
      success: true,
      resumen: {
        locationData_previo: locationData.length,
        locationData_final: locationData.length + creados.length,
        creados_desde_direccion: fromDireccion,
        qr_sin_direccion_ni_comuna: qrSkipped,
        total_creados: creados.length,
      },
      qr_para_revision_manual: qrSkippedList,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});