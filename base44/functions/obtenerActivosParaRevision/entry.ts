import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Endpoint PÚBLICO (sin auth) que el banco (BAPRO) usa para ver los activos
// de un lote de revisión. Valida el token + expiración antes de devolver datos.
// Solo lectura — no muta nada.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sb = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const { token } = body;
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

    // Cargar activos del lote.
    const activoIds = Array.isArray(tok.activo_ids) ? tok.activo_ids : [];
    let activos = [];
    const scopeQuery = tok.sede_scope && tok.sede_scope !== 'TODAS'
      ? { sector_id: tok.sector_id, location_id: tok.sede_scope }
      : { sector_id: tok.sector_id };

    if (activoIds.length > 0) {
      // Snapshot del lote: filtrar por sector del token + IDs explícitos.
      const all = await sb.entities.Asset.filter({ sector_id: tok.sector_id }, '-name', 500).catch(() => []);
      const idSet = new Set(activoIds);
      activos = all.filter(a => idSet.has(a.id));
    }
    // Fallback: si el snapshot no devuelve activos (movidos de sector, dados de
    // baja, o lote vacío), mostrar los activos actuales del sector/sede del mes.
    if (activos.length === 0) {
      activos = await sb.entities.Asset.filter(scopeQuery, '-name', 500).catch(() => []);
    }

    // Cargar OTs del sector (historial por activo + listado del mes).
    const allOts = await sb.entities.WorkOrder.filter({ sector_id: tok.sector_id }, '-created_date', 500).catch(() => []);

    // OTs por activo (top 10, campos seguros) — historial de mantenimiento.
    const assetIds = activos.map(a => a.id);
    const idSet = new Set(assetIds);
    const otsByAsset = {};
    for (const o of allOts) {
      if (o.asset_id && idSet.has(o.asset_id)) {
        if (!otsByAsset[o.asset_id]) otsByAsset[o.asset_id] = [];
        if (otsByAsset[o.asset_id].length < 10) {
          otsByAsset[o.asset_id].push({
            title: o.title,
            status: o.status,
            scheduled_date: o.scheduled_date,
            completed_date: o.completed_date,
          });
        }
      }
    }

    // Rango del mes del lote (YYYY-MM).
    const [yy, mm] = (tok.mes_periodo || '').split('-').map(Number);
    const mesStart = new Date(yy || 2000, (mm || 1) - 1, 1).getTime();
    const mesEnd = new Date(yy || 2000, mm || 12, 1).getTime();
    const inMes = (d) => { if (!d) return false; const t = new Date(d).getTime(); return t >= mesStart && t < mesEnd; };

    // Modificaciones del mes (AssetHistory) por activo — lifecycle del mes.
    const allHist = await sb.entities.AssetHistory.filter({ sector_id: tok.sector_id }, '-created_date', 500).catch(() => []);
    const modsByAsset = {};
    for (const h of allHist) {
      if (!h.asset_id || !inMes(h.created_date)) continue;
      if (!modsByAsset[h.asset_id]) modsByAsset[h.asset_id] = [];
      if (modsByAsset[h.asset_id].length < 20) {
        modsByAsset[h.asset_id].push({
          tipo_evento: h.tipo_evento,
          descripcion: h.descripcion,
          fecha: h.created_date,
          ot_id: h.ot_id || null,
        });
      }
    }

    // OTs generadas en el mes (listado plano para la solapa de OTs).
    const otsMes = [];
    for (const o of allOts) {
      if (!inMes(o.created_date)) continue;
      if (otsMes.length >= 200) break;
      otsMes.push({
        id: o.id,
        title: o.title,
        status: o.status,
        type: o.type,
        priority: o.priority,
        scheduled_date: o.scheduled_date,
        completed_date: o.completed_date,
        created_date: o.created_date,
        asset_name: o.asset_name || null,
        location: o.location || null,
      });
    }

    // Devolver solo campos seguros (sin documentos internos, costo de adquisición
    // ni datos sensibles). El "visto" se calcula por el mes del lote (mes-a-mes).
    const mes = tok.mes_periodo;
    const safe = activos.map(a => {
      const histMes = a.vistos_bapro_meses && a.vistos_bapro_meses[mes];
      const vistoMes = !!histMes;
      return {
        id: a.id,
        name: a.name,
        code: a.code,
        type: a.type,
        brand: a.brand,
        model: a.model,
        serial_number: a.serial_number,
        sede: a.sede,
        area: a.area,
        location: a.location,
        status: a.status,
        criticality: a.criticality,
        visto_bapro: vistoMes,
        visto_bapro_fecha: histMes ? histMes.fecha : null,
        ots: otsByAsset[a.id] || [],
        modificaciones: modsByAsset[a.id] || [],
      };
    });

    return Response.json({
      ok: true,
      sede_nombre: tok.sede_nombre,
      mes_periodo: tok.mes_periodo,
      expiracion: tok.expiracion,
      total: safe.length,
      vistos: safe.filter(a => a.visto_bapro).length,
      activos: safe,
      ots_mes: otsMes,
      total_ots_mes: otsMes.length,
    });
  } catch (err) {
    console.error('obtenerActivosParaRevision error:', err);
    return Response.json({ error: `Error interno: ${err.message}` }, { status: 500 });
  }
});