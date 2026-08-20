import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import * as XLSX from 'npm:xlsx@0.18.5';
import { createScopedClient, resolveCallerSector, SectorError } from '../../shared/sectorGuard.ts';
import { locationDataToEdificioPayload } from '../../shared/locationSync.ts';
import { normalizeName, parseDate, mapEnum, findHeaderIndex, findHeaderRow, assertAllowedFileUrl, TYPE_MAP, STATUS_MAP, CRIT_MAP, COMUNA_VALID, SEDE_HEADERS } from '../../shared/excelImport.ts';

// Importer masivo de Activos BAPRO con auto-creación de ubicaciones.
//
// Diferencia con importarActivosExcel: si una sede del Excel no existe como
// LocationData/Edificio, la CREA (LocationData + Edificio espejo) con el
// sector_id del caller estampado, y vincula el activo.
//
// OPTIMIZACIONES PARA VOLUMEN GRANDE:
//   1. Pre-fetch paginado de existentes (LocationData, Edificio, Asset) sin
//      tope de 5000 — pagina por cursor de updated_date hasta traer todo.
//   2. Pre-creación de sedes en PARALELO (chunks de 10) ANTES del loop de
//      filas: convierte O(2N) llamadas secuenciales en O(N/10) round-trips.
//   3. Comuna saneada (trim) y validada contra enum antes de crear → evita 400.
//   4. ubic_tecnica con sufijo anti-colisión (contador) para sedes con el
//      mismo prefijo normalizado.
//   5. bulkCreate de activos en batches de 50 con fallback binario (split
//      a la mitad) para aislar registros malos sin caer a 1-a-1 secuencial.

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const LOCATION_PARALLEL = 10;   // sedes creadas en paralelo
const ASSET_BATCH = 50;          // bulkCreate size
const FETCH_PAGE = 5000;         // página del pre-fetch
const FETCH_MAX_PAGES = 20;     // tope de páginas (100k registros) anti-loop

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
    // cursor = updated_date del último (más viejo) de la página ordenada desc
    const last = page[page.length - 1];
    cursor = last.updated_date || last.created_date || null;
    if (!cursor) break;
  }
  return out;
}

// Sanea y valida la comuna contra el enum de LocationData (8A/8B/10A).
// Cualquier valor inválido cae a '10A' — nunca se envía un enum inválido (400).
function safeComuna(raw) {
  const c = String(raw || '').trim().toUpperCase();
  return COMUNA_VALID.has(c) ? c : '10A';
}

// Genera un ubic_tecnica único dentro del lote (anti-colisión por prefijo).
function makeUbicTecnica(norm, counter) {
  const base = (norm || 'sede').slice(0, 40).replace(/[^a-z0-9-]/g, '').padEnd(3, 'x');
  return `${base}-${counter}`;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'gerente') {
      return Response.json({ error: 'Forbidden: solo admin/gerente' }, { status: 403 });
    }

    const callerSector = resolveCallerSector(user);
    const sb = createScopedClient(base44, callerSector);

    const body = await req.json().catch(() => ({}));
    const { file_url, auto_create_locations = true } = body;
    if (!file_url || typeof file_url !== 'string') {
      return Response.json({ error: 'file_url requerido' }, { status: 400 });
    }

    try { assertAllowedFileUrl(file_url); }
    catch (e) { return Response.json({ error: e.message }, { status: 400 }); }

    // ── Descarga + parse del Excel ──────────────────────────────────────
    const res = await fetch(file_url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) return Response.json({ error: `Descarga fallida: ${res.status}` }, { status: 400 });
    const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_FILE_SIZE) return Response.json({ error: 'Archivo demasiado grande (máx 50MB)' }, { status: 413 });
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength === 0) return Response.json({ error: 'Archivo vacío' }, { status: 400 });
    if (buffer.byteLength > MAX_FILE_SIZE) return Response.json({ error: 'Archivo demasiado grande (máx 50MB)' }, { status: 413 });

    let workbook;
    try {
      workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });
    } catch (err) {
      return Response.json({ error: `Formato Excel inválido: ${err.message}` }, { status: 400 });
    }
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return Response.json({ error: 'Workbook sin hojas' }, { status: 400 });
    }
    const sheetName = workbook.SheetNames.find(n => /activ/i.test(n)) || workbook.SheetNames[0];
    const ws = workbook.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
    if (!raw || raw.length < 2) {
      return Response.json({ error: 'Planilla sin datos (requiere headers + filas)' }, { status: 400 });
    }

    const headerRowIdx = findHeaderRow(raw);
    const headers = raw[headerRowIdx] || [];

    const colSede = findHeaderIndex(headers, SEDE_HEADERS);
    const colCode = findHeaderIndex(headers, ['codigo', 'cod', 'code']);
    const colName = findHeaderIndex(headers, ['nombre', 'name', 'activo', 'descripcion', 'descripción']);
    const colType = findHeaderIndex(headers, ['tipo', 'type']);
    const colBrand = findHeaderIndex(headers, ['marca', 'brand']);
    const colModel = findHeaderIndex(headers, ['modelo', 'model']);
    const colSerial = findHeaderIndex(headers, ['serie', 'serial', 'n° serie', 'n serie', 'nro serie']);
    const colArea = findHeaderIndex(headers, ['area', 'área', 'zona', 'departamento']);
    const colJefe = findHeaderIndex(headers, ['jefe', 'jefe de sitio', 'responsable']);
    const colComuna = findHeaderIndex(headers, ['comuna']);
    const colStatus = findHeaderIndex(headers, ['estado', 'status']);
    const colCrit = findHeaderIndex(headers, ['criticidad', 'critic', 'prioridad']);
    const colLoc = findHeaderIndex(headers, ['ubicacion', 'ubicación', 'ubicacion detallada', 'location']);
    const colCost = findHeaderIndex(headers, ['costo', 'costo adquisicion', 'valor']);
    const colPurchase = findHeaderIndex(headers, ['fecha compra', 'compra', 'purchase date']);
    const colWarranty = findHeaderIndex(headers, ['garantia', 'garantía', 'vence garantia']);
    const colLastM = findHeaderIndex(headers, ['ultimo mantenimiento', 'último mantenimiento', 'ult mant']);
    const colNextM = findHeaderIndex(headers, ['proximo mantenimiento', 'próximo mantenimiento', 'prox mant']);
    const colFreq = findHeaderIndex(headers, ['frecuencia', 'frecuencia (dias)']);
    const colNotes = findHeaderIndex(headers, ['notas', 'observaciones', 'obs']);

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

    const parseErrors = [];
    const sedesCreadas = [];

    // ── PASADA 1: recolectar sedes únicas del Excel ──────────────────────
    // Sede por defecto si no hay columna sede.
    const uniqueSedes = new Map(); // norm → { raw, comuna, jefe }
    const hasSedeCol = colSede >= 0;
    let defaultSedeNorm = normalizeName('Sede Principal');

    for (let i = headerRowIdx + 1; i < raw.length; i++) {
      const row = raw[i];
      if (!row || row.length === 0) continue;
      const name = colName >= 0 && row[colName] ? String(row[colName]).trim() : null;
      if (!name) continue; // sin nombre → se salta y se reporta en pasada 2

      const sedeRaw = hasSedeCol && row[colSede] ? String(row[colSede]).trim() : '';
      const comunaRaw = colComuna >= 0 && row[colComuna] ? String(row[colComuna]).trim() : '';
      const jefeRaw = colJefe >= 0 && row[colJefe] ? String(row[colJefe]).trim() : '';

      const sedeNorm = sedeRaw ? normalizeName(sedeRaw) : defaultSedeNorm;
      if (!uniqueSedes.has(sedeNorm)) {
        uniqueSedes.set(sedeNorm, {
          raw: sedeRaw || 'Sede Principal',
          comuna: comunaRaw,
          jefe: jefeRaw,
        });
      }
    }

    // ── PASADA 2: crear sedes faltantes en paralelo (chunks) ─────────────
    const sedesToCreateLD = []; // norms que necesitan LocationData
    for (const [norm, info] of uniqueSedes) {
      if (!ldByNorm.has(norm) && !edByNorm.has(norm)) {
        sedesToCreateLD.push(norm);
      }
    }

    let ubicCounter = 0;
    const createdLDs = []; // { norm, ld }
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
          ldByNorm.set(norm, false); // cachea fallo
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

    // Resolver location_id por norm → reusa cache; si la creación falló, null.
    function resolveSedeId(sedeRaw) {
      const norm = sedeRaw ? normalizeName(sedeRaw) : defaultSedeNorm;
      const ed = edByNorm.get(norm);
      if (ed) return { location_id: ed.id, sedeNombre: ed.nombre };
      const ld = ldByNorm.get(norm);
      if (ld) return { location_id: ld.id, sedeNombre: ld.establecimiento };
      return { location_id: null, sedeNombre: sedeRaw || '' };
    }

    // ── PASADA 3: construir assets (sin awaits) ─────────────────────────
    const toCreate = [];
    const toUpdate = [];
    let duplicados = 0;

    for (let i = headerRowIdx + 1; i < raw.length; i++) {
      const row = raw[i];
      if (!row || row.length === 0) continue;
      const name = colName >= 0 && row[colName] ? String(row[colName]).trim() : null;
      if (!name) { parseErrors.push(`Fila ${i + 1}: sin nombre de activo`); continue; }

      const sedeRaw = hasSedeCol && row[colSede] ? String(row[colSede]).trim() : '';
      const code = colCode >= 0 && row[colCode] ? String(row[colCode]).trim() : '';

      const { location_id, sedeNombre } = resolveSedeId(sedeRaw);

      const jefeRaw = colJefe >= 0 && row[colJefe] ? String(row[colJefe]).trim() : '';
      const tipo = colType >= 0 && row[colType] ? mapEnum(row[colType], TYPE_MAP, 'otro') : 'otro';
      const estado = colStatus >= 0 && row[colStatus] ? mapEnum(row[colStatus], STATUS_MAP, 'operativo') : 'operativo';
      const criticidad = colCrit >= 0 && row[colCrit] ? mapEnum(row[colCrit], CRIT_MAP, 'media') : 'media';

      const asset = {
        name: name.slice(0, 255),
        code: code ? code.slice(0, 100) : '',
        type: tipo,
        brand: colBrand >= 0 && row[colBrand] ? String(row[colBrand]).trim().slice(0, 100) : '',
        model: colModel >= 0 && row[colModel] ? String(row[colModel]).trim().slice(0, 100) : '',
        serial_number: colSerial >= 0 && row[colSerial] ? String(row[colSerial]).trim().slice(0, 100) : '',
        location_id,
        sede: sedeNombre || '',
        area: colArea >= 0 && row[colArea] ? String(row[colArea]).trim().slice(0, 100) : '',
        jefe_sitio: jefeRaw.slice(0, 100),
        status: estado,
        criticality: criticidad,
        location: colLoc >= 0 && row[colLoc] ? String(row[colLoc]).trim().slice(0, 255) : '',
        purchase_cost: colCost >= 0 && row[colCost] ? Math.max(0, parseFloat(row[colCost]) || 0) : 0,
        purchase_date: colPurchase >= 0 ? parseDate(row[colPurchase]) : null,
        warranty_expiry: colWarranty >= 0 ? parseDate(row[colWarranty]) : null,
        last_maintenance: colLastM >= 0 ? parseDate(row[colLastM]) : null,
        next_maintenance: colNextM >= 0 ? parseDate(row[colNextM]) : null,
        maintenance_frequency_days: colFreq >= 0 && row[colFreq] ? Math.max(1, parseInt(row[colFreq], 10) || 90) : 90,
        notes: colNotes >= 0 && row[colNotes] ? String(row[colNotes]).trim().slice(0, 1000) : '',
      };

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
    const errorDetails = [];

    async function bulkCreateWithFallback(batch) {
      try {
        await sb.entities.Asset.bulkCreate(batch);
        created += batch.length;
      } catch (err) {
        if (batch.length <= 1) {
          errors++;
          errorDetails.push(`Crear [${batch[0].code || '?'}] ${batch[0].name.slice(0, 40)}: ${err.message}`);
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

    // Procesar en paralelo (chunks independientes) para reducir tiempo total.
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

    return Response.json({
      ok: true,
      sector: callerSector,
      imported: created + updated,
      created,
      updated,
      errors,
      errorDetails: errorDetails.slice(0, 20),
      duplicados,
      filas_invalidas: parseErrors.length,
      parseErrors: parseErrors.slice(0, 20),
      sedes_creadas: sedesCreadas.length,
      sedes_creadas_detalle: sedesCreadas.slice(0, 50),
      sedes_totales_unicas: uniqueSedes.size,
      sedes_preexistentes: uniqueSedes.size - sedesToCreateLD.length,
      auto_create_locations,
    });
  } catch (err) {
    if (err instanceof SectorError) return Response.json({ error: err.message }, { status: err.status });
    console.error('importarActivosBapro error:', err);
    return Response.json({ error: `Error interno: ${err.message}`, imported: 0, created: 0, updated: 0, errors: 1 }, { status: 500 });
  }
}