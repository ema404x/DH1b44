import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { locations } = await req.json();
    if (!Array.isArray(locations) || locations.length === 0) {
      return Response.json({ error: 'No locations provided' }, { status: 400 });
    }

    let imported = 0;
    let errors = 0;
    const errorsList = [];

    // Procesar en lotes de 10 para evitar rate limit
    for (let i = 0; i < locations.length; i += 10) {
      const batch = locations.slice(i, i + 10);
      
      for (const loc of batch) {
        try {
          // Buscar si existe
          const existing = await base44.asServiceRole.entities.LocationData.filter({
            ubic_tecnica: loc.ubic_tecnica?.toLowerCase(),
          });

          if (existing.length > 0) {
            await base44.asServiceRole.entities.LocationData.update(existing[0].id, loc);
          } else {
            await base44.asServiceRole.entities.LocationData.create(loc);
          }
          imported++;
        } catch (err) {
          errors++;
          errorsList.push(`${loc.establecimiento || 'Sin nombre'}: ${err.message}`);
        }
      }

      // Pequeña pausa entre lotes
      if (i + 10 < locations.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return Response.json({
      success: true,
      imported,
      errors,
      errorsList: errorsList.slice(0, 10),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});