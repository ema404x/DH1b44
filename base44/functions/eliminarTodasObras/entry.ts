import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Solo administradores pueden usar esta función' }, { status: 403 });
    }

    // Fail closed: sin sector → no se borra nada. Nunca defaultear a 'escuela'.
    const callerSector = user?.data?.sector_id || user?.sector_id;
    if (!callerSector) {
      return Response.json({ error: 'Sin sector asignado' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const ids = body.ids;            // array opcional; si no viene, borra TODO el sector
    const dryRun = body.dryRun === true;

    const sb = base44.asServiceRole;

    // Proyectos del sector del llamador (tope 5000). No uso skip-based pagination
    // en filter (dead-end conocido: el SDK ignora el offset). Si un sector supera
    // 5000, ejecutar nuevamente — los ya borrados dejan de aparecer.
    const sectorProjects = await sb.entities.Project.filter(
      { sector_id: callerSector }, '-created_date', 5000
    );
    const sectorIdSet = new Set(sectorProjects.map(p => p.id));

    let toDeleteIds = [];
    let skipped = 0;
    if (ids && ids.length > 0) {
      // "borrar seleccionados": solo ids que pertenecen al sector del llamador.
      toDeleteIds = ids.filter(id => sectorIdSet.has(id));
      skipped = ids.length - toDeleteIds.length; // ids de otro sector o inexistentes
    } else {
      // "borrar todo": todos los del sector del llamador.
      toDeleteIds = Array.from(sectorIdSet);
    }

    // dryRun: reportar alcance sin borrar nada.
    if (dryRun) {
      const toDeleteSet = new Set(toDeleteIds);
      const sample = sectorProjects
        .filter(p => toDeleteSet.has(p.id))
        .slice(0, 20)
        .map(p => ({ id: p.id, name: p.name, sector_id: p.sector_id }));
      return Response.json({
        dryRun: true,
        wouldDelete: toDeleteIds.length,
        skipped,
        sector: callerSector,
        capped: sectorProjects.length === 5000,
        sample
      });
    }

    // Borrado real, en lotes (mantiene shape deleted/errors que usa el llamador).
    let deleted = 0;
    let errors = 0;
    const BATCH = 20;
    for (let i = 0; i < toDeleteIds.length; i += BATCH) {
      const batch = toDeleteIds.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map(id => sb.entities.Project.delete(id))
      );
      deleted += results.filter(r => r.status === 'fulfilled').length;
      errors  += results.filter(r => r.status === 'rejected').length;
    }

    return Response.json({ deleted, errors, skipped, total: toDeleteIds.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});