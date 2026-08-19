import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { resolveCallerSector, SectorError } from "../../shared/sectorGuard.ts";

// Reclama los activos huérfanos (sector_id vacío) asignándolos al sector del
// admin que ejecuta la acción. Necesario porque imports legacy no estampaban
// sector_id y el link BAPRO filtra por sector (consecuencia: 0 activos en el
// link y catálogo vacío para el admin). Solo admin.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: solo admin' }, { status: 403 });

    const callerSector = resolveCallerSector(user);
    const sb = base44.asServiceRole;

    // Traer todos los activos (asServiceRole bypassa RLS) y filtrar los sin sector.
    // El filtro {sector_id: null} no es confiable en todas las impl; filtramos en memoria.
    const all = await sb.entities.Asset.list('-updated_date', 500).catch(() => []);
    const huerfanos = all.filter(a => !a.sector_id);

    if (huerfanos.length === 0) {
      return Response.json({ ok: true, reclamados: 0, message: 'No hay activos sin sector.' });
    }

    const updates = huerfanos.map(a => ({ id: a.id, sector_id: callerSector }));
    let reclamados = 0;
    try {
      await sb.entities.Asset.bulkUpdate(updates);
      reclamados = updates.length;
    } catch (_) {
      // Fallback uno por uno si el bulk falla.
      for (const u of updates) {
        try { await sb.entities.Asset.update(u.id, { sector_id: callerSector }); reclamados++; }
        catch (e) { console.warn(`reclamar: falló id=${u.id}: ${e.message}`); }
      }
    }

    return Response.json({ ok: true, reclamados, sector: callerSector });
  } catch (err) {
    if (err instanceof SectorError) return Response.json({ error: err.message }, { status: err.status });
    console.error('reclamarActivosSinSector error:', err);
    return Response.json({ error: `Error interno: ${err.message}` }, { status: 500 });
  }
});