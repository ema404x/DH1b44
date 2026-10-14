import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { resolveReviewScope } from '../../shared/baproReviewScope.ts';
import { sectorErrorResponse } from '../../shared/sectorGuard.ts';

// Endpoint PÚBLICO (sin auth) que el banco (BAPRO) usa para ver los activos
// de un lote de revisión. Valida el token + expiración antes de devolver datos.
// Solo lectura — no muta nada.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const { token } = await req.json().catch(() => ({}));
    const { tok, sb, loadAssets } = await resolveReviewScope(base44, token);
    const activos = await loadAssets();
    const loteIds = activos.map(a => a.id);
    // Los historiales y las OTs no pueden ampliar el lote a otras sedes.
    const allOts = loteIds.length
      ? await sb.entities.WorkOrder.filter({ asset_id: { $in: loteIds } }, '-created_date', 500)
      : [];

    // Rango del mes del lote (YYYY-MM).
    const [yy, mm] = (tok.mes_periodo || '').split('-').map(Number);
    const mesStart = new Date(yy || 2000, (mm || 1) - 1, 1).getTime();
    const mesEnd = new Date(yy || 2000, mm || 12, 1).getTime();
    const inMes = (d) => { if (!d) return false; const t = new Date(d).getTime(); return t >= mesStart && t < mesEnd; };

    // OTs por activo del mes (top 10, campos seguros) — historial del mes.
    const assetIds = activos.map(a => a.id);
    const idSet = new Set(assetIds);
    const otsByAsset = {};
    for (const o of allOts) {
      if (o.asset_id && idSet.has(o.asset_id) && inMes(o.created_date)) {
        if (!otsByAsset[o.asset_id]) otsByAsset[o.asset_id] = [];
        if (otsByAsset[o.asset_id].length < 10) {
          otsByAsset[o.asset_id].push({
            title: o.title,
            status: o.status,
            type: o.type,
            scheduled_date: o.scheduled_date,
            completed_date: o.completed_date,
          });
        }
      }
    }

    // Modificaciones del mes (AssetHistory) por activo — lifecycle del mes.
    const allHist = loteIds.length
      ? await sb.entities.AssetHistory.filter({ asset_id: { $in: loteIds } }, '-created_date', 500)
      : [];
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
      if (!idSet.has(o.asset_id) || !inMes(o.created_date)) continue;
      if (o.status !== 'completada') continue;
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
    return sectorErrorResponse(err);
  }
}