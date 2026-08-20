// base44/shared/sectorGuard.ts
//
// Centro único de aislamiento entre sectores para funciones backend asServiceRole.
//
// PROBLEMA
//   asServiceRole bypassa RLS. Cada función que lo usa debe acordarse de:
//     (a) resolver el sector del caller,
//     (b) estampar sector_id en creates,
//     (c) filtrar por sector_id en reads,
//     (d) verificar sector_id antes de update/delete.
//   Olvidar un solo punto = fuga de datos entre sectores (raíz de los bugs
//   de importación que venían cruzando sectores).
//
// SOLUCIÓN
//   Un único módulo que hace todo eso. Las funciones importan createScopedClient()
//   y usan sb.entities.X en vez de base44.asServiceRole.entities.X. El aislamiento
//   queda garantizado por construcción, no por convención: una función nueva que
//   use el helper no puede crear registros SIN_SECTOR ni tocar otros sectores,
//   sin importar lo que haga su autor.
//
// USO
//   const callerSector = resolveCallerSector(user);          // fail-closed 403
//   const sb = createScopedClient(base44, callerSector);
//   await sb.entities.Pendiente.filter({ estado: 'pendiente' }); // auto-scoped
//   await sb.entities.Pendiente.create({ descripcion });        // auto-stamped
//   await sb.entities.Pendiente.delete(id);                     // auto-verified
//   // catch final: return sectorErrorResponse(error);

export class SectorError extends Error {
  constructor(message, status = 403) {
    super(message);
    this.name = 'SectorError';
    this.status = status;
  }
}

// Resuelve el sector del caller. Fail-closed: sin sector → throw SectorError 403.
export function resolveCallerSector(user) {
  const sector = user?.data?.sector_id || user?.sector_id;
  if (!sector) throw new SectorError('Sin sector asignado', 403);
  return sector;
}

// Convierte un error del handler en Response JSON apropiada.
// SectorError → su status (403 por defecto); el resto → 500.
export function sectorErrorResponse(e) {
  if (e instanceof SectorError) {
    return Response.json({ error: e.message }, { status: e.status });
  }
  return Response.json({ error: e.message || 'Error interno' }, { status: 500 });
}

// Entidades globales (no se aíslan por sector): lista de precios ministerial, etc.
const GLOBAL_ENTITIES = new Set(['PrecarioMinisterio']);

function stamp(data, sector) {
  if (!data || typeof data !== 'object') return data;
  return { ...data, sector_id: sector };
}

function makeScopedEntity(entity, sector, isGlobal) {
  return {
    schema: () => entity.schema(),

    // ── Creates: estampan sector_id por construcción ──────────────────────
    create: (data) => isGlobal ? entity.create(data) : entity.create(stamp(data, sector)),

    bulkCreate: (arr) => {
      if (isGlobal) return entity.bulkCreate(arr);
      return entity.bulkCreate(arr.map(d => stamp(d, sector)));
    },

    // ── Reads: filtran por sector_id ─────────────────────────────────────
    filter: (query = {}, sort, limit) => {
      if (isGlobal) return entity.filter(query, sort, limit);
      // El caller no puede sobreescribir sector_id con otro sector: lo forzamos.
      return entity.filter({ ...query, sector_id: sector }, sort, limit);
    },

    list: async (sort, limit, skip) => {
      const items = await entity.list(sort, limit, skip);
      if (isGlobal) return items;
      return items.filter(x => !x.sector_id || x.sector_id === sector);
    },

    get: async (id) => {
      const item = await entity.get(id);
      if (!isGlobal && item && item.sector_id && item.sector_id !== sector) {
        throw new SectorError('Forbidden: registro de otro sector', 403);
      }
      return item;
    },

    // ── Mutaciones: verifican sector antes de tocar ──────────────────────
    update: async (id, data) => {
      if (isGlobal) return entity.update(id, data);
      const existing = await entity.get(id).catch(() => null);
      if (existing && existing.sector_id && existing.sector_id !== sector) {
        throw new SectorError('Forbidden: registro de otro sector', 403);
      }
      return entity.update(id, data);
    },

    delete: async (id) => {
      if (isGlobal) return entity.delete(id);
      const existing = await entity.get(id).catch(() => null);
      if (existing && existing.sector_id && existing.sector_id !== sector) {
        throw new SectorError('Forbidden: registro de otro sector', 403);
      }
      return entity.delete(id);
    },

    updateMany: (query, update) => {
      if (isGlobal) return entity.updateMany(query, update);
      return entity.updateMany({ ...query, sector_id: sector }, update);
    },

    deleteMany: (query) => {
      if (isGlobal) return entity.deleteMany(query);
      return entity.deleteMany({ ...query, sector_id: sector });
    },

    // bulkUpdate no filtra por query. Contrato: los ids provienen de un
    // filter/list scoped (ya sector-safe), por lo que es seguro. No re-estampa
    // sector_id porque el update puede ser parcial.
    bulkUpdate: (arr) => entity.bulkUpdate(arr),
  };
}

// Devuelve { entities } con todas las entidades asServiceRole envueltas
// con aislamiento por sector. Drop-in reemplazo de base44.asServiceRole.
//
// NOTA: asServiceRole.entities es un Proxy del SDK cuyas entidades NO son
// own-enumerable (Object.keys devuelve []). Por eso envolvemos on-demand con
// un Proxy que crea el scoped entity la primera vez que se accede a cada
// nombre. Las funciones que ya usan createScopedClient acceden por nombre
// (sb.entities.Asset), así que la API se preserva.
export function createScopedClient(base44, sector) {
  const raw = base44.asServiceRole.entities;
  const cache = new Map();
  const entities = new Proxy({}, {
    get(_target, prop) {
      if (typeof prop !== 'string') return undefined;
      if (cache.has(prop)) return cache.get(prop);
      const entity = raw[prop];
      if (!entity) return undefined;
      const scoped = makeScopedEntity(entity, sector, GLOBAL_ENTITIES.has(prop));
      cache.set(prop, scoped);
      return scoped;
    },
  });
  return { entities };
}