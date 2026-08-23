// base44/shared/assetBulkImport.ts
//
// Núcleo compartido de importación masiva de Activos.
// Extraído de importarActivosBapro para reutilizarlo en importarActivosPDF
// (y futuros importers) sin duplicar la lógica de resolución de sedes,
// dedupe por código y bulkCreate/bulkUpdate con fallback binario.
//
// CONTRATO
//   bulkImportAssets(sb, inputs, { autoCreateLocations }) → { created, updated, errors, ... }
//
//   inputs: array de objetos con campos crudos (strings del Excel/PDF).
//     { name, code, type, brand, model, serial_number, sede, area, jefe_sitio,
//       comuna, status, criticality, location, purchase_cost, purchase_date,
//       warranty_expiry, last_maintenance, next_maintenance,
//       maintenance_frequency_days, notes }
//   Los enums (type/status/criticality) llegan como strings crudos y se mapean
//   acá vía mapEnum. Las fechas se parsean con parseDate. Las sedes faltantes se
//   crean como LocationData + Edificio cuando autoCreateLocations=true.
//
//   sb: cliente scoped (createScopedClient) — ya aísla por sector_id por construcción.

import { normalizeName, parseDate, mapEnum, TYPE_MAP, STATUS_MAP, CRIT_MAP, COMUNA_VALID } from './excelImport.ts';
import { locationDataToEdificioPayload } from './locationSync.ts';

const LOCATION_PARALLEL = 10;
const ASSET_BATCH = 50;
const FETCH_PAGE = 5000;
const FETCH_MAX_PAGES = 20;

// Pagina un entity por cursor de updated_date hasta traer todo (o hasta
// FETCH_MAX_PAGES). Evita el tope de 5000 del list() simple.
async function fetchAll(sb, entityName) {
  const out = [];
  let cursor: string | null = null;
  for (let p = 0; p < FETCH_MAX_PAGES; p++) {
    let page;
    if (cursor) {
      page = await sb.entities[entityName].filter(
        { updated_date: { $lt: cursor } },
        '-updated_date',
        FETCH_PAGE,
      );
    } else {
      page = await sb.entities[entityName].list('-updated_date', FETCH_PAGE);
    }
    if (!page || page.length === 0) break;
    out.push(...page);
    if (page.length < FETCH_PAGE) break;
    const last = page[page.length - 1];
    cursor = last.updated_date || last.created_date || null;
    if (!cursor) break;
  }
  return out;
}

// Sanea y valida la comuna contra el enum de LocationData (8A/8B/10A).
function safeComuna(raw) {
  const c = String(raw || '').trim().toUpperCase();
  return COMUNA_VALID.has(c) ? c : '10A';
}

// Genera un ubic_tecnica único dentro del lote (anti-colisión por prefijo).
function makeUbicTecnica(norm, counter) {
  const base = (norm || 'sede').slice(0, 40).replace(/[^a-z0-9-]/g, '').padEnd(3, 'x');
  return `${base}-${counter}`;
}

// Normaliza un input crudo a un asset listo para crear (enum mapeado, fechas parseadas).
function buildAssetPayload(input, location_id, sedeNombre) {
  return {
    name: String(input.name || '').trim().slice(0, 255),
    code: input.code ? String(input.code).trim().slice(0, 100) : '',
    type: mapEnum(input.type, TYPE_MAP, 'otro'),
    brand: input.brand ? String(input.brand).trim().slice(0, 100) : '',
    model: input.model ? String(input.model).trim().slice(0, 100) : '',
    serial_number: input.serial_number ? String(input.serial_number).trim().slice(0, 100) : '',
    location_id,
    sede: sedeNombre || '',
    area: input.area ? String(input.area).trim().slice(0, 100) : '',
    jefe_sitio: input.jefe_sitio ? String(input.jefe_sitio).trim().slice(0, 100) : '',
    status: mapEnum(input.status, STATUS_MAP, 'operativo'),
    criticality: mapEnum(input.criticality, CRIT_MAP, 'media'),
    location: input.location ? String(input.location).trim().slice(0, 255) : '',
    purchase_cost: input.purchase_cost ? Math.max(0, parseFloat(String(input.purchase_cost)) || 0) : 0,
    purchase_date: parseDate(input.purchase_date),
    warranty_expiry: parseDate(input.warranty_expiry),
    last_maintenance: parseDate(input.last_maintenance),
    next_maintenance: parseDate(input.next_maintenance),
    maintenance_frequency_days: input.maintenance_frequency_days
      ? Math.max(1, parseInt(String(input.maintenance_frequency_days), 10) || 90)
      : 90,
    notes: input.notes ? String(input.notes).trim().slice(0, 1000) : '',
  };
}

export async function bulkImportAssets(sb, inputs, opts: { autoCreateLocations?: boolean } = {}) {
  const { autoCreateLocations = true } = opts;

  // ── Pre-fetch paginado de existentes ─────────────────────────────────
  const [allLD, allEd, existing] = await Promise.all([
    fetchAll(sb, 'LocationData').catch(() => []),
    fetchAll(sb, 'Edificio').catch(() => []),
    fetchAll(sb, 'Asset').catch(() => []),
  ]);

  const ldByNorm = new Map();
  for (const ld of allLD) {
    const n = normalizeName(ld.establecimiento || ld.ubic_tecnica);
    if (n) ldByNorm.set(n, ld);
  }
  const edByNorm = new Map();
  const edByLink = new Map();
  for (const ed of allEd) {
    const n = normalizeName(ed.nombre);
    if (n) edByNorm.set(n, ed);
    if (ed.location_id) edByLink.set(ed.location_id, ed);
  }
  const existingByCode = new Map();
  for (const a of existing) if (a.code) existingByCode.set(normalizeName(a.code), a);

  const parseErrors: string[] = [];
  const sedesCreadas: any[] = [];

  // ── PASADA 1: recolectar sedes únicas del lote ───────────────────────
  const uniqueSedes = new Map(); // norm → { raw, comuna, jefe }
  const defaultSedeNorm = normalizeName('Sede Principal');

  for (const input of inputs) {
    if (!input.name || !String(input.name).trim()) continue;
    const sedeRaw = input.sede ? String(input.sede).trim() : '';
    const comunaRaw = input.comuna ? String(input.comuna).trim() : '';
    const jefeRaw = input.jefe_sitio ? String(input.jefe_sitio).trim() : '';
    const sedeNorm = sedeRaw ? normalizeName(sedeRaw) : defaultSedeNorm;
    if (!uniqueSedes.has(sedeNorm)) {
      uniqueSedes.set(sedeNorm, { raw: sedeRaw || 'Sede Principal', comuna: comunaRaw, jefe: jefeRaw });
    }
  }

  // ── PASADA 2: crear sedes faltantes en paralelo (chunks) ─────────────
  const sedesToCreateLD: string[] = [];
  for (const [norm] of uniqueSedes) {
    if (!ldByNorm.has(norm) && !edByNorm.has(norm)) sedesToCreateLD.push(norm);
  }

  let ubicCounter = 0;
  const createdLDs: any[] = [];
  if (autoCreateLocations) {
    for (let i = 0; i < sedesToCreateLD.length; i += LOCATION_PARALLEL) {
      const chunk = sedesToCreateLD.slice(i, i + LOCATION_PARALLEL);
      const payloads = chunk.map(norm => {
        const info = uniqueSedes.get(norm);
        ubicCounter++;
        return {
          norm,
          payload: {
            ubic_tecnica: makeUbicTecnica(norm, ubicCounter),
            establecimiento: info.raw.slice(0, 200),
            comuna: safeComuna(info.comuna),
            jefe_sitio: info.jefe.slice(0, 100),
            estado: 'activo',
          },
        };
      });
      const results = await Promise.allSettled(
        payloads.map(p => sb.entities.LocationData.create(p.payload)),
      );
      results.forEach((r, idx) => {
        const norm = payloads[idx].norm;
        if (r.status === 'fulfilled') {
          const ld = r.value;
          ldByNorm.set(norm, ld);
          createdLDs.push({ norm, ld });
          sedesCreadas.push({ nombre: uniqueSedes.get(norm).raw, locationdata_id: ld.id });
        } else {
          parseErrors.push(`Sede "${uniqueSedes.get(norm).raw}": no se creó ubicación (${r.reason?.message || r.reason})`);
          ldByNorm.set(norm, false);
        }
      });
    }

    // Crear Edificios espejo para los LocationData recién creados (paralelo).
    const edificiosToCreate = createdLDs.filter(({ ld }) => ld && !edByLink.has(ld.id));
    for (let i = 0; i < edificiosToCreate.length; i += LOCATION_PARALLEL) {
      const chunk = edificiosToCreate.slice(i, i + LOCATION_PARALLEL);
      const payloads = chunk.map(({ norm, ld }) => {
        const info = locationDataToEdificioPayload(ld);
        return {
          norm, ld,
          payload: {
            nombre: info.nombre || uniqueSedes.get(norm).raw,
            comuna: info.comuna || 'Otra',
            jefe_sitio: info.jefe_sitio || '',
            activo: info.activo !== false,
            location_id: ld.id,
          },
        };
      });
      const results = await Promise.allSettled(
        payloads.map(p => sb.entities.Edificio.create(p.payload)),
      );
      results.forEach((r, idx) => {
        const { norm, ld } = payloads[idx];
        if (r.status === 'fulfilled') {
          const ed = r.value;
          edByNorm.set(norm, ed);
          edByLink.set(ld.id, ed);
        } else {
          parseErrors.push(`Sede "${uniqueSedes.get(norm).raw}": no se creó edificio (${r.reason?.message || r.reason})`);
          edByNorm.set(norm, false);
        }
      });
    }
  }

  // Resolver location_id por norm.
  function resolveSedeId(sedeRaw) {
    const norm = sedeRaw ? normalizeName(sedeRaw) : defaultSedeNorm;
    const ed = edByNorm.get(norm);
    if (ed) return { location_id: ed.id, sedeNombre: ed.nombre };
    const ld = ldByNorm.get(norm);
    if (ld) return { location_id: ld.id, sedeNombre: ld.establecimiento };
    return { location_id: null, sedeNombre: sedeRaw || '' };
  }

  // ── PASADA 3: construir assets (sin awaits) ──────────────────────────
  const toCreate: any[] = [];
  const toUpdate: any[] = [];
  let duplicados = 0;

  let idx = 0;
  for (const input of inputs) {
    idx++;
    if (!input.name || !String(input.name).trim()) {
      parseErrors.push(`Ítem ${idx}: sin nombre de activo`);
      continue;
    }
    const sedeRaw = input.sede ? String(input.sede).trim() : '';
    const code = input.code ? String(input.code).trim() : '';
    const { location_id, sedeNombre } = resolveSedeId(sedeRaw);
    const asset = buildAssetPayload(input, location_id, sedeNombre);

    const matchKey = code ? normalizeName(code) : null;
    const existingAsset = matchKey ? existingByCode.get(matchKey) : null;
    if (existingAsset && existingAsset.id && existingAsset.id !== 'pending') {
      toUpdate.push({ id: existingAsset.id, ...asset });
    } else if (existingAsset && existingAsset.id === 'pending') {
      duplicados++;
    } else {
      toCreate.push(asset);
      if (matchKey) existingByCode.set(matchKey, { id: 'pending', ...asset });
    }
  }

  // ── bulkCreate / bulkUpdate con fallback binario ────────────────────
  let created = 0, updated = 0, errors = 0;
  const errorDetails: string[] = [];

  async function bulkCreateWithFallback(batch) {
    try {
      await sb.entities.Asset.bulkCreate(batch);
      created += batch.length;
    } catch (err) {
      if (batch.length <= 1) {
        errors++;
        errorDetails.push(`Crear [${batch[0].code || '?'}] ${String(batch[0].name).slice(0, 40)}: ${err.message}`);
        return;
      }
      const mid = Math.floor(batch.length / 2);
      await bulkCreateWithFallback(batch.slice(0, mid));
      await bulkCreateWithFallback(batch.slice(mid));
    }
  }

  async function bulkUpdateWithFallback(batch) {
    try {
      await sb.entities.Asset.bulkUpdate(batch);
      updated += batch.length;
    } catch (err) {
      if (batch.length <= 1) {
        errors++;
        errorDetails.push(`Actualizar [${batch[0].code}] id=${batch[0].id}: ${err.message}`);
        return;
      }
      const mid = Math.floor(batch.length / 2);
      await bulkUpdateWithFallback(batch.slice(0, mid));
      await bulkUpdateWithFallback(batch.slice(mid));
    }
  }

  const createBatches = [];
  for (let b = 0; b < toCreate.length; b += ASSET_BATCH) {
    createBatches.push(toCreate.slice(b, b + ASSET_BATCH));
  }
  await Promise.allSettled(createBatches.map(bulkCreateWithFallback));

  const updateBatches = [];
  for (let b = 0; b < toUpdate.length; b += ASSET_BATCH) {
    updateBatches.push(toUpdate.slice(b, b + ASSET_BATCH));
  }
  await Promise.allSettled(updateBatches.map(bulkUpdateWithFallback));

  return {
    created,
    updated,
    errors,
    duplicados,
    sedes_creadas: sedesCreadas.length,
    sedes_creadas_detalle: sedesCreadas.slice(0, 50),
    sedes_totales_unicas: uniqueSedes.size,
    sedes_preexistentes: uniqueSedes.size - sedesToCreateLD.length,
    parseErrors,
    errorDetails,
  };
}