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
    if (activoIds.length > 0) {
      // Filtrar por sector del token + IDs explícitos.
      const all = await sb.entities.Asset.filter({ sector_id: tok.sector_id }, '-name', 500).catch(() => []);
      const idSet = new Set(activoIds);
      activos = all.filter(a => idSet.has(a.id));
    } else {
      // Scope por sede.
      const query = tok.sede_scope && tok.sede_scope !== 'TODAS'
        ? { sector_id: tok.sector_id, location_id: tok.sede_scope }
        : { sector_id: tok.sector_id };
      activos = await sb.entities.Asset.filter(query, '-name', 500).catch(() => []);
    }

    // Devolver solo campos seguros (sin documentos internos ni datos sensibles).
    const safe = activos.map(a => ({
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
      purchase_cost: a.purchase_cost,
      visto_bapro: !!a.visto_bapro,
      visto_bapro_fecha: a.visto_bapro_fecha || null,
    }));

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