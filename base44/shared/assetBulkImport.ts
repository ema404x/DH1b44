// base44/shared/assetBulkImport.ts
//
// Núcleo compartido de importación masiva de Activos.
//
// Modos:
//   - dryRun=true:  parsea + valida SIN escribir. Devuelve preview (filas
//                   clasificadas, sedes a crear, duplicados, errores).
//   - dryRun=false: ejecuta el import real. Crea sedes faltantes, bulk
//                   create/update con dedupe y fallback binario, captura
//                   snapshots de los assets actualizados (para rollback) y
//                   re-feathea los IDs creados (por created_date >= startTime).
//                   Devuelve created_ids, updated_snapshots, sedes_creadas_ids.
//
// CONTRATO
//   bulkImportAssets(sb, inputs, { autoCreateLocations, dryRun })
//     → { created, updated, errors, duplicados, sedes_creadas, sedes_creadas_ids,
//         created_ids, updated_ids, updated_snapshots, snapshot_completo,
//         preview_rows, total_filas, sedes_a_crear, errores, parseErrors, errorDetails }
//
//   inputs: [{ name, code, type, brand, model, serial_number, sede, area,
//             jefe_sitio, comuna, status, criticality, location, purchase_cost,
//             purchase_date, warranty_expiry, last_maintenance, next_maintenance,
//             maintenance_frequency_days, notes }]
//
//   sb: cliente scoped (createScopedClient) — aísla por sector_id por construcción.

import { normalizeName, parseDate, mapEnum, TYPE_MAP, STATUS_MAP, CRIT_MAP, COMUNA_VALID } from './excelImport.ts';
import { locationDataToEdificioPayload } from './locationSync.ts';

const LOCATION_PARALLEL = 10;
const ASSET_BATCH = 50;
const FETCH_PAGE = 5000;
const FETCH_MAX_PAGES = 20;
const SNAPSHOT_CAP = 1000; // sobre 1000 updates, guardo solo ids (snapshot_completo=false)
const SLIM_FIELDS = [
  'name', 'code', 'type', 'brand', 'model', 'serial_number',
  'location_id', 'sede', 'area', 'jefe_sitio', 'status', 'criticality',
  'location', 'purchase_cost', 'purchase_date', 'warranty_expiry',
  'last_maintenance', 'next_maintenance', 'maintenance_frequency_days', 'notes',
];

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

function safeComuna(raw) {
  const c = String(raw || '').trim().toUpperCase();
  return COMUNA_VALID.has(c) ? c : '10A';
}

function makeUbicTecnica(norm, counter) {
  const base = (norm || 'sede').slice(0, 40).replace(/[^a-z0-9-]/g, '').padEnd(3, 'x');
  return `${base}-${counter}`;
}

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

// Snapshot slim del asset previo (solo campos de negocio) para rollback.
function slimSnapshot(asset) {
  const snap = {};
  for (const f of SLIM_FIELDS) snap[f] = asset[f] ?? null;
  return snap;
}

// Determina si un valor crudo mapea a un enum conocido (para validar en preview).
function enumValid(raw, map) {
  if (!raw || !String(raw).trim()) return true; // vacío = usa default, no es error
  const k = normalizeName(raw);
  return !!(map[k] || map[String(raw).toLowerCase().trim()]);
}

export async function bulkImportAssets(sb, inputs, opts: { autoCreateLocations?: boolean; dryRun?: boolean } = {}) {
  const { autoCreateLocations = true, dryRun = false } = opts;

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
  const sedesCreadas: { locationdata_id: string; nombre: string }[] = [];
  const sedesCreadasIds: string[] = [];
  const defaultSedeNorm = normalizeName('Sede Principal');

  // ── PASADA 1: recolectar sedes únicas del lote ───────────────────────
  const uniqueSedes = new Map();
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

  const sedesToCreateLD: string[] = [];
  for (const [norm] of uniqueSedes) {
    if (!ldByNorm.has(norm) && !edByNorm.has(norm)) sedesToCreateLD.push(norm);
  }

  // ── PASADA 2: crear sedes faltantes (solo en modo real) ──────────────
  let ubicCounter = 0;
  const createdLDs: { norm: string; ld: any }[] = [];
  if (!dryRun && autoCreateLocations) {
    for (let i = 0; i < sedesToCreateLD.length; i += LOCATION_PARALLEL) {
      const chunk = sedesToCreateLD.slice(i, i + LOCATION_PARALLEL);
      const payloads = chunk.map((norm) => {
        const info = uniqueSedes.get(norm);
        ubicCounter++;
        return { norm, payload: {
          ubic_tecnica: makeUbicTecnica(norm, ubicCounter),
          establecimiento: info.raw.slice(0, 200),
          comuna: safeComuna(info.comuna),
          jefe_sitio: info.jefe.slice(0, 100),
          estado: 'activo',
        } };
      });
      const results = await Promise.allSettled(payloads.map(p => sb.entities.LocationData.create(p.payload)));
      results.forEach((r, idx) => {
        const norm = payloads[idx].norm;
        if (r.status === 'fulfilled') {
          ldByNorm.set(norm, r.value);
          createdLDs.push({ norm, ld: r.value });
          sedesCreadas.push({ nombre: uniqueSedes.get(norm).raw, locationdata_id: r.value.id });
          sedesCreadasIds.push(r.value.id);
        } else {
          parseErrors.push(`Sede "${uniqueSedes.get(norm).raw}": no se creó ubicación (${r.reason?.message || r.reason})`);
          ldByNorm.set(norm, false);
        }
      });
    }
    const edificiosToCreate = createdLDs.filter(({ ld }) => ld && !edByLink.has(ld.id));
    for (let i = 0; i < edificiosToCreate.length; i += LOCATION_PARALLEL) {
      const chunk = edificiosToCreate.slice(i, i + LOCATION_PARALLEL);
      const payloads = chunk.map(({ norm, ld }) => {
        const info = locationDataToEdificioPayload(ld);
        return { norm, ld, payload: {
          nombre: info.nombre || uniqueSedes.get(norm).raw,
          comuna: info.comuna || 'Otra',
          jefe_sitio: info.jefe_sitio || '',
          activo: info.activo !== false,
          location_id: ld.id,
        } };
      });
      const results = await Promise.allSettled(payloads.map(p => sb.entities.Edificio.create(p.payload)));
      results.forEach((r, idx) => {
        const { norm, ld } = payloads[idx];
        if (r.status === 'fulfilled') { edByNorm.set(norm, r.value); edByLink.set(ld.id, r.value); }
        else { parseErrors.push(`Sede "${uniqueSedes.get(norm).raw}": no se creó edificio (${r.reason?.message || r.reason})`); edByNorm.set(norm, false); }
      });
    }
  }

  function resolveSedeId(sedeRaw) {
    const norm = sedeRaw ? normalizeName(sedeRaw) : defaultSedeNorm;
    const ed = edByNorm.get(norm);
    if (ed) return { location_id: ed.id, sedeNombre: ed.nombre, sedeExiste: true };
    const ld = ldByNorm.get(norm);
    if (ld) return { location_id: ld.id, sedeNombre: ld.establecimiento, sedeExiste: true };
    return { location_id: null, sedeNombre: sedeRaw || '', sedeExiste: false };
  }

  // ── PASADA 3: clasificar filas (validación + plan) ───────────────────
  const preview_rows: any[] = [];
  const errores: { fila: number; motivo: string }[] = [];
  const duplicados: { fila: number; code: string; name: string }[] = [];
  const toCreate: any[] = [];
  const toUpdate: { id: string; [k: string]: any }[] = [];
  const updated_snapshots: { id: string; snapshot: any }[] = [];
  const updated_ids: string[] = [];
  let dupWithinFile = 0;

  let fila = 0;
  for (const input of inputs) {
    fila++;
    const name = input.name ? String(input.name).trim() : '';
    if (!name) {
      preview_rows.push({ fila, name: '(vacío)', code: input.code || '', sede: input.sede || '', status: 'error', motivo: 'Falta nombre del activo' });
      errores.push({ fila, motivo: 'Falta nombre del activo' });
      continue;
    }

    const code = input.code ? String(input.code).trim() : '';
    const sedeRaw = input.sede ? String(input.sede).trim() : '';
    const { location_id, sedeNombre, sedeExiste } = resolveSedeId(sedeRaw);

    // Validaciones de enum (no bloqueantes: mapean a default, pero se reportan)
    const problemas: string[] = [];
    if (input.type && !enumValid(input.type, TYPE_MAP)) problemas.push(`tipo "${input.type}" no reconocido`);
    if (input.status && !enumValid(input.status, STATUS_MAP)) problemas.push(`estado "${input.status}" no reconocido`);
    if (input.criticality && !enumValid(input.criticality, CRIT_MAP)) problemas.push(`criticidad "${input.criticality}" no reconocida`);
    if (input.comuna && !COMUNA_VALID.has(String(input.comuna).trim().toUpperCase())) problemas.push(`comuna "${input.comuna}" inválida`);

    // Sede sin resolver
    let sedeSinResolver = false;
    if (sedeRaw && !sedeExiste) {
      if (autoCreateLocations) {
        // se creará → sede_nueva
      } else {
        sedeSinResolver = true;
        problemas.push(`sede "${sedeRaw}" no encontrada`);
      }
    }

    const matchKey = code ? normalizeName(code) : null;
    const existingAsset = matchKey ? existingByCode.get(matchKey) : null;

    let status: string;
    let motivo: string | null = null;
    if (sedeSinResolver || problemas.length > 0) {
      status = 'error';
      motivo = problemas.join('; ') || 'Sede no encontrada';
      errores.push({ fila, motivo });
    } else if (existingAsset && existingAsset.id && existingAsset.id !== 'pending') {
      status = 'actualizar';
      duplicados.push({ fila, code, name });
    } else if (existingAsset && existingAsset.id === 'pending') {
      status = 'duplicado_archivo';
      motivo = 'Código repetido dentro del archivo';
      dupWithinFile++;
    } else if (sedeRaw && !sedeExiste && autoCreateLocations) {
      status = 'sede_nueva';
    } else {
      status = 'crear';
    }

    preview_rows.push({
      fila, name: name.slice(0, 60), code, sede: sedeNombre || sedeRaw, sede_existe: sedeExiste,
      tipo: mapEnum(input.type, TYPE_MAP, 'otro'), estado: mapEnum(input.status, STATUS_MAP, 'operativo'),
      criticidad: mapEnum(input.criticality, CRIT_MAP, 'media'), status, motivo,
    });

    // En modo real, armar payloads (solo filas válidas)
    if (!dryRun && (status === 'crear' || status === 'actualizar' || status === 'sede_nueva')) {
      const asset = buildAssetPayload(input, location_id, sedeNombre);
      if (status === 'actualizar' && existingAsset && existingAsset.id !== 'pending') {
        toUpdate.push({ id: existingAsset.id, ...asset });
        updated_ids.push(existingAsset.id);
        // Snapshot slim (con cap)
        if (updated_snapshots.length < SNAPSHOT_CAP) {
          updated_snapshots.push({ id: existingAsset.id, snapshot: slimSnapshot(existingAsset) });
        }
      } else if (status !== 'duplicado_archivo') {
        toCreate.push(asset);
        if (matchKey) existingByCode.set(matchKey, { id: 'pending', ...asset });
      }
    }
  }

  // ── Modo dry-run: devolver preview sin escribir ──────────────────────
  if (dryRun) {
    const sedes_a_crear = sedesToCreateLD.map(norm => {
      const info = uniqueSedes.get(norm);
      return { nombre: info.raw, comuna: safeComuna(info.comuna), jefe_sitio: info.jefe };
    });
    const counts = preview_rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {} as any);
    return {
      dry_run: true,
      total_filas: preview_rows.length,
      preview_rows: preview_rows.slice(0, 25),
      counts,
      sedes_a_crear,
      sedes_existentes: uniqueSedes.size - sedesToCreateLD.length,
      sedes_totales_unicas: uniqueSedes.size,
      duplicados,
      duplicados_count: duplicados.length + dupWithinFile,
      errores,
      errores_count: errores.length,
      parseErrors,
    };
  }

  // ── Modo real: ejecutar bulk create/update ───────────────────────────
  const startTime = new Date().toISOString();
  let created = 0, updated = 0, errors = 0;
  const errorDetails: string[] = [];

  async function bulkCreateWithFallback(batch) {
    try {
      await sb.entities.Asset.bulkCreate(batch);
      created += batch.length;
    } catch (err) {
      if (batch.length <= 1) {
        errors++; errorDetails.push(`Crear [${batch[0].code || '?'}] ${String(batch[0].name).slice(0, 40)}: ${err.message}`);
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
        errors++; errorDetails.push(`Actualizar [${batch[0].code}] id=${batch[0].id}: ${err.message}`);
        return;
      }
      const mid = Math.floor(batch.length / 2);
      await bulkUpdateWithFallback(batch.slice(0, mid));
      await bulkUpdateWithFallback(batch.slice(mid));
    }
  }

  const createBatches = [];
  for (let b = 0; b < toCreate.length; b += ASSET_BATCH) createBatches.push(toCreate.slice(b, b + ASSET_BATCH));
  await Promise.allSettled(createBatches.map(bulkCreateWithFallback));

  const updateBatches = [];
  for (let b = 0; b < toUpdate.length; b += ASSET_BATCH) updateBatches.push(toUpdate.slice(b, b + ASSET_BATCH));
  await Promise.allSettled(updateBatches.map(bulkUpdateWithFallback));

  // ── Re-feathear created_ids por created_date >= startTime ─────────────
  const created_ids: string[] = [];
  try {
    const recent = await sb.entities.Asset.filter(
      { created_date: { $gte: startTime } },
      '-created_date',
      FETCH_PAGE,
    );
    for (const a of recent) created_ids.push(a.id);
  } catch {
    // Si el re-fetch falla, created_ids queda vacío (rollback no podrá borrar
    // los creados, pero los updates sí se pueden restaurar por snapshot).
  }

  const snapshot_completo = updated_snapshots.length >= updated_ids.length;

  return {
    dry_run: false,
    created,
    updated,
    errors,
    duplicados: duplicados.length + dupWithinFile,
    sedes_creadas: sedesCreadas.length,
    sedes_creadas_ids: sedesCreadasIds,
    created_ids,
    updated_ids,
    updated_snapshots,
    snapshot_completo,
    total_filas: preview_rows.length,
    parseErrors,
    errorDetails,
  };
}