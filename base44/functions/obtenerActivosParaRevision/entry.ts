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

    // Cargar OTs vinculadas a los activos del lote (misma sector) para mostrar
    // el historial de mantenimiento al banco. Solo campos operativos, no sensibles.
    const assetIds = activos.map(a => a.id);
    const otsByAsset = {};
    if (assetIds.length > 0) {
      const allOts = await sb.entities.WorkOrder.filter({ sector_id: tok.sector_id }, '-created_date', 200).catch(() => []);
      const idSet = new Set(assetIds);
      for (const o of allOts) {
        if (o.asset_id && idSet.has(o.asset_id)) {
          // Tope de 10 OTs por activo (ya ordenado por -created_date) y solo
          // campos mostrados en la vista pública — sin nombres de empleados
          // ni datos internos, porque el link se comparte con el banco sin login.
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
    });
  } catch (err) {
    console.error('obtenerActivosParaRevision error:', err);
    return Response.json({ error: `Error interno: ${err.message}` }, { status: 500 });
  }
});