import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Solo administradores pueden usar esta función' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const ids = body.ids; // array opcional; si no viene, borra todo

    let toDelete = ids;
    if (!toDelete || toDelete.length === 0) {
      // Obtener todos los IDs de proyectos
      const all = await base44.asServiceRole.entities.Project.list('id', 5000);
      toDelete = all.map(p => p.id);
    }

    let deleted = 0;
    let errors = 0;
    const BATCH = 20;

    for (let i = 0; i < toDelete.length; i += BATCH) {
      const batch = toDelete.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map(id => base44.asServiceRole.entities.Project.delete(id))
      );
      deleted += results.filter(r => r.status === 'fulfilled').length;
      errors  += results.filter(r => r.status === 'rejected').length;
    }

    return Response.json({ deleted, errors, total: toDelete.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});