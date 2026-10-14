import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { resolveReviewScope } from '../../shared/baproReviewScope.ts';
import { sectorErrorResponse } from '../../shared/sectorGuard.ts';

// Endpoint PÚBLICO (sin auth) que el banco (BAPRO) usa para marcar un activo
// (o todos los del lote) como visto en el mes del lote. Valida token + expiración
// + pertenencia al lote antes de mutar. Solo escribe campos visto_bapro*.
//
// Modelo mes-a-mes: cada marca se registra en vistos_bapro_meses[mes] sin
// sobrescribir meses previos. El booleano visto_bapro (backward-compat) refleja
// el último lote visto. vistos_count es idempotente (no acumula re-marcas).

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { token, asset_id, marcar_todos } = body;
    const { tok, sb, getAsset, loadAssets } = await resolveReviewScope(base44, token);
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

    const cargarLote = loadAssets;

    let marcadosAhora = 0;

    if (marcar_todos) {
      const activos = await cargarLote();
      const updates = activos.map(buildUpdate);
      if (updates.length > 0) {
        for (let i = 0; i < updates.length; i += 500) {
          await sb.entities.Asset.bulkUpdate(updates.slice(i, i + 500));
        }
      }
      // Exacto: todos los del lote quedan vistos para este mes.
      vistosCountFinal = activos.length;
      marcadosAhora = activos.length;
    } else {
      if (!asset_id) return Response.json({ error: 'asset_id requerido' }, { status: 400 });

      // Comprueba sector, sede y snapshot también cuando hay IDs explícitos.
      const a = await getAsset(asset_id);

      // Idempotente: si ya estaba visto en este mes, no incrementa el contador.
      const yaVisto = !!(a.vistos_bapro_meses && a.vistos_bapro_meses[lote]);
      if (!yaVisto) {
        await sb.entities.Asset.update(asset_id, buildUpdate(a));
        marcadosAhora = 1;
        vistosCountFinal = (tok.vistos_count || 0) + 1;
      }
    }

    await sb.entities.RevisionBaproToken.update(tok.id, {
      vistos_count: vistosCountFinal,
      ultima_actividad: ahora,
      estado: 'usado',
    });

    return Response.json({ ok: true, vistos: marcadosAhora, total_vistos: vistosCountFinal });
  } catch (err) {
    console.error('registrarVistoBapro error:', err);
    return sectorErrorResponse(err);
  }
}