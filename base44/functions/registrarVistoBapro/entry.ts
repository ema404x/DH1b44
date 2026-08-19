import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Endpoint PÚBLICO (sin auth) que el banco (BAPRO) usa para marcar un activo
// (o todos los del lote) como visto. Valida el token + expiración + que el
// activo pertenezca al lote antes de mutar. Solo escribe campos visto_bapro*.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sb = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const { token, asset_id, marcar_todos } = body;
    if (!token || typeof token !== 'string') {
      return Response.json({ error: 'token requerido' }, { status: 400 });
    }

    const tokens = await sb.entities.RevisionBaproToken.filter({ token }).catch(() => []);
    const tok = tokens[0];
    if (!tok) return Response.json({ error: 'Link inválido' }, { status: 404 });
    if (tok.estado === 'revocado') return Response.json({ error: 'Link revocado' }, { status: 403 });
    if (new Date(tok.expiracion).getTime() < Date.now()) {
      return Response.json({ error: 'Link expirado' }, { status: 410 });
    }

    const activoIds = Array.isArray(tok.activo_ids) ? tok.activo_ids : [];
    const ahora = new Date().toISOString();
    const lote = tok.mes_periodo;
    let vistosSet = new Set();

    if (marcar_todos) {
      // Marcar todos los del lote.
      let activos = [];
      if (activoIds.length > 0) {
        const all = await sb.entities.Asset.filter({ sector_id: tok.sector_id }, '-name', 500).catch(() => []);
        const idSet = new Set(activoIds);
        activos = all.filter(a => idSet.has(a.id));
      } else {
        const query = tok.sede_scope && tok.sede_scope !== 'TODAS'
          ? { sector_id: tok.sector_id, location_id: tok.sede_scope }
          : { sector_id: tok.sector_id };
        activos = await sb.entities.Asset.filter(query, '-name', 500).catch(() => []);
      }
      const updates = activos.map(a => ({
        id: a.id,
        visto_bapro: true,
        visto_bapro_fecha: ahora,
        visto_bapro_por: tok.token,
        visto_bapro_lote: lote,
      }));
      if (updates.length > 0) {
        await sb.entities.Asset.bulkUpdate(updates).catch(async (err) => {
          for (const u of updates) {
            try { await sb.entities.Asset.update(u.id, u); } catch (_) {}
          }
        });
      }
      vistosSet = new Set(activos.map(a => a.id));
    } else {
      // Marcar un activo individual. Validar que pertenece al lote.
      if (!asset_id) return Response.json({ error: 'asset_id requerido' }, { status: 400 });
      let pertenece = true;
      if (activoIds.length > 0) {
        pertenece = activoIds.includes(asset_id);
      } else {
        const a = await sb.entities.Asset.get(asset_id).catch(() => null);
        pertenece = a && a.sector_id === tok.sector_id &&
          (!tok.sede_scope || tok.sede_scope === 'TODAS' || a.location_id === tok.sede_scope);
      }
      if (!pertenece) return Response.json({ error: 'Activo fuera del lote' }, { status: 403 });

      await sb.entities.Asset.update(asset_id, {
        visto_bapro: true,
        visto_bapro_fecha: ahora,
        visto_bapro_por: tok.token,
        visto_bapro_lote: lote,
      }).catch(() => {});
      vistosSet.add(asset_id);
    }

    // Actualizar contador del token.
    const vistosCount = (tok.vistos_count || 0) + vistosSet.size;
    await sb.entities.RevisionBaproToken.update(tok.id, {
      vistos_count: vistosCount,
      ultima_actividad: ahora,
      estado: 'usado',
    }).catch(() => {});

    return Response.json({ ok: true, vistos: vistosSet.size, total_vistos: vistosCount });
  } catch (err) {
    console.error('registrarVistoBapro error:', err);
    return Response.json({ error: `Error interno: ${err.message}` }, { status: 500 });
  }
});