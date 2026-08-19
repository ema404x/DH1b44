import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Endpoint PÚBLICO (sin auth) que el banco (BAPRO) usa para marcar un activo
// (o todos los del lote) como visto en el mes del lote. Valida token + expiración
// + pertenencia al lote antes de mutar. Solo escribe campos visto_bapro*.
//
// Modelo mes-a-mes: cada marca se registra en vistos_bapro_meses[mes] sin
// sobrescribir meses previos. El booleano visto_bapro (backward-compat) refleja
// el último lote visto. vistos_count es idempotente (no acumula re-marcas).

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
    let vistosCountFinal = tok.vistos_count || 0;

    // Construye el payload de update mergeando el histórico por mes + campos backward-compat.
    const buildUpdate = (a) => {
      const hist = (a.vistos_bapro_meses && typeof a.vistos_bapro_meses === 'object')
        ? { ...a.vistos_bapro_meses } : {};
      hist[lote] = { fecha: ahora, por: tok.token };
      return {
        id: a.id,
        vistos_bapro_meses: hist,
        visto_bapro: true,
        visto_bapro_fecha: ahora,
        visto_bapro_por: tok.token,
        visto_bapro_lote: lote,
      };
    };

    // Carga los activos del lote (por IDs explícitos o por scope de sede).
    const cargarLote = async () => {
      if (activoIds.length > 0) {
        const all = await sb.entities.Asset.filter({ sector_id: tok.sector_id }, '-name', 500).catch(() => []);
        const idSet = new Set(activoIds);
        return all.filter(a => idSet.has(a.id));
      }
      const query = tok.sede_scope && tok.sede_scope !== 'TODAS'
        ? { sector_id: tok.sector_id, location_id: tok.sede_scope }
        : { sector_id: tok.sector_id };
      return sb.entities.Asset.filter(query, '-name', 500).catch(() => []);
    };

    let marcadosAhora = 0;

    if (marcar_todos) {
      const activos = await cargarLote();
      const updates = activos.map(buildUpdate);
      if (updates.length > 0) {
        await sb.entities.Asset.bulkUpdate(updates).catch(async () => {
          for (const u of updates) {
            try { await sb.entities.Asset.update(u.id, u); } catch (_) {}
          }
        });
      }
      // Exacto: todos los del lote quedan vistos para este mes.
      vistosCountFinal = activos.length;
      marcadosAhora = activos.length;
    } else {
      if (!asset_id) return Response.json({ error: 'asset_id requerido' }, { status: 400 });

      // Validar pertenencia al lote y cargar el activo para merge del histórico.
      let a = null;
      let pertenece = true;
      if (activoIds.length > 0) {
        pertenece = activoIds.includes(asset_id);
        if (pertenece) a = await sb.entities.Asset.get(asset_id).catch(() => null);
      } else {
        a = await sb.entities.Asset.get(asset_id).catch(() => null);
        pertenece = !!a && a.sector_id === tok.sector_id &&
          (!tok.sede_scope || tok.sede_scope === 'TODAS' || a.location_id === tok.sede_scope);
      }
      if (!pertenece) return Response.json({ error: 'Activo fuera del lote' }, { status: 403 });
      if (!a) return Response.json({ error: 'Activo no encontrado' }, { status: 404 });

      // Idempotente: si ya estaba visto en este mes, no incrementa el contador.
      const yaVisto = !!(a.vistos_bapro_meses && a.vistos_bapro_meses[lote]);
      if (!yaVisto) {
        await sb.entities.Asset.update(asset_id, buildUpdate(a)).catch(() => {});
        marcadosAhora = 1;
        vistosCountFinal = (tok.vistos_count || 0) + 1;
      }
    }

    await sb.entities.RevisionBaproToken.update(tok.id, {
      vistos_count: vistosCountFinal,
      ultima_actividad: ahora,
      estado: 'usado',
    }).catch(() => {});

    return Response.json({ ok: true, vistos: marcadosAhora, total_vistos: vistosCountFinal });
  } catch (err) {
    console.error('registrarVistoBapro error:', err);
    return Response.json({ error: `Error interno: ${err.message}` }, { status: 500 });
  }
});