import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { createScopedClient, sectorErrorResponse } from '../../shared/sectorGuard.ts';
import { resolveAndReconcileSector } from '../../shared/callerIdentity.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores pueden importar ubicaciones' }, { status: 403 });
    const { sector: callerSector } = await resolveAndReconcileSector(base44.asServiceRole, user);
    const sb = createScopedClient(base44, callerSector);

    const { locations } = await req.json();
    if (!Array.isArray(locations) || locations.length === 0) {
      return Response.json({ error: 'No locations provided' }, { status: 400 });
    }

    if (locations.some(loc => Object.prototype.hasOwnProperty.call(loc, 'sector_id') && loc.sector_id !== callerSector)) {
      return Response.json({ error: 'La importación contiene ubicaciones de otro sector' }, { status: 403 });
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
          const existing = await sb.entities.LocationData.filter({
            ubic_tecnica: loc.ubic_tecnica?.toLowerCase(),
          });

          if (existing.length > 0) {
            await sb.entities.LocationData.update(existing[0].id, loc);
          } else {
            await sb.entities.LocationData.create({ ...loc, sector_id: loc.sector_id || callerSector });
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
    return sectorErrorResponse(error);
  }
}