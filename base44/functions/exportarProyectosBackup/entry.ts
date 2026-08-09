import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Exporta TODOS los Project (asServiceRole) a un JSON y lo sube a storage.
// Devuelve un link de descarga público. Uso: backup real antes de migraciones
// destructivas (ej. backfill de sector_id). Solo admin.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Solo administradores pueden exportar' }, { status: 403 });
    }

    const sb = base44.asServiceRole;
    const all = [];
    let skip = 0;
    while (true) {
      const chunk = await sb.entities.Project.list('-created_date', 5000, skip);
      all.push(...chunk);
      if (chunk.length < 5000) break;
      skip += 5000;
    }

    const backup = {
      exportado: new Date().toISOString(),
      exportado_por: user.email || user.id,
      total: all.length,
      tipo: 'Project',
      notas: 'Backup previo al backfill de sector_id. Conserva todos los campos (incl. built-in id/created_date/updated_date/created_by_id).',
      registros: all,
    };
    const json = JSON.stringify(backup, null, 2);
    const fecha = new Date().toISOString().slice(0, 10);
    // UploadFile requiere un File (con nombre), no un Blob plano.
    const file = new File([json], `backup-proyectos-${fecha}.json`, { type: 'application/json' });
    const up = await base44.integrations.Core.UploadFile({ file });

    return Response.json({
      success: true,
      total: all.length,
      backup_url: up?.file_url || up?.url || null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});