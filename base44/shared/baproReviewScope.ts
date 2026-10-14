import { createScopedClient, SectorError } from './sectorGuard.ts';

// El código aleatorio autoriza un único sector y lote, nunca un ámbito ampliado.
export async function resolveReviewScope(base44, token) {
  if (typeof token !== 'string' || token.trim().length < 32 || token !== token.trim()) {
    throw new SectorError('Link inválido', 400);
  }
  const tokens = await base44.asServiceRole.entities.RevisionBaproToken.filter({ token }, '-created_date', 2);
  if (tokens.length !== 1) throw new SectorError('Link inválido', 404);
  const tok = tokens[0];
  if (!['activo', 'usado'].includes(tok.estado)) throw new SectorError('Link no habilitado');
  const expires = Date.parse(tok.expiracion);
  if (!Number.isFinite(expires) || expires <= Date.now()) throw new SectorError('Link expirado', 410);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(tok.mes_periodo || '')) throw new SectorError('Período inválido');
  const sb = createScopedClient(base44, tok.sector_id);
  const inScope = asset => !!asset && asset.sector_id === tok.sector_id &&
    (!tok.sede_scope || tok.sede_scope === 'TODAS' || asset.location_id === tok.sede_scope);
  const ids = Array.isArray(tok.activo_ids) ? [...new Set(tok.activo_ids)] : [];
  const fixed = tok.snapshot_fijo === true || ids.length > 0;
  const getAsset = async id => {
    if (fixed && !ids.includes(id)) throw new SectorError('Activo fuera del lote');
    const asset = await sb.entities.Asset.get(id);
    if (!inScope(asset)) throw new SectorError('Activo fuera de la sede del lote');
    return asset;
  };
  const loadAssets = async () => {
    if (fixed) {
      const assets = [];
      for (let i = 0; i < ids.length; i += 6) {
        const batch = await Promise.all(ids.slice(i, i + 6).map(id =>
          base44.asServiceRole.entities.Asset.get(id).catch(error => {
            if (error.status === 404 || error.response?.status === 404) return null;
            throw error;
          })));
        assets.push(...batch.filter(inScope));
      }
      return assets;
    }
    const query = tok.sede_scope && tok.sede_scope !== 'TODAS' ? { location_id: tok.sede_scope } : {};
    const assets = [];
    let cursor;
    do {
      const page = await sb.entities.Asset.filter(query, { sort: '-name', limit: 500, cursor });
      assets.push(...page.items);
      cursor = page.has_more ? page.next_cursor : undefined;
    } while (cursor);
    return assets;
  };
  return { tok, sb, getAsset, loadAssets };
}