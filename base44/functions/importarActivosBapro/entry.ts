import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import * as XLSX from 'npm:xlsx@0.18.5';
import { createScopedClient, resolveCallerSector, SectorError } from '../../shared/sectorGuard.ts';
import { locationDataToEdificioPayload } from '../../shared/locationSync.ts';
import { normalizeName, parseDate, mapEnum, findHeaderIndex, findHeaderRow, assertAllowedFileUrl, TYPE_MAP, STATUS_MAP, CRIT_MAP, COMUNA_VALID, SEDE_HEADERS } from '../../shared/excelImport.ts';

// Importer masivo de Activos BAPRO con auto-creación de ubicaciones.
//
// Diferencia con importarActivosExcel: si una sede del Excel no existe como
// LocationData/Edificio, la CREA (LocationData + Edificio espejo) con el
// sector_id del caller estampado, y vincula el activo. Esto deja el catálogo
// de BAPRO listo para go-live sin pre-carga manual de ubicaciones.
//
// Flow por fila:
//   sede normalizada → buscar LocationData por nombre → si no, crear LocationData
//   → buscar Edificio por location_id → si no, crear Edificio espejo
//   → crear/actualizar Asset con location_id = Edificio.id, sede, sector_id.
//
// Validación: nombre requerido, sede requerida (se crea si falta), code opcional
// (dedup), tipo/comuna dentro del enum. Filas inválidas se saltan y reportan.

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

    const res = await fetch(file_url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) return Response.json({ error: `Descarga fallida: ${res.status}` }, { status: 400 });
    const MAX_SIZE = 50 * 1024 * 1024;
    const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_SIZE) return Response.json({ error: 'Archivo demasiado grande (máx 50MB)' }, { status: 413 });
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength === 0) return Response.json({ error: 'Archivo vacío' }, { status: 400 });
    if (buffer.byteLength > MAX_SIZE) return Response.json({ error: 'Archivo demasiado grande (máx 50MB)' }, { status: 413 });

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

    // Caches de sedes (LocationData + Edificio) por nombre normalizado.
    let allLD = [];
    let allEd = [];
    try { allLD = await sb.entities.LocationData.list('-updated_date', 5000); } catch { allLD = []; }
    try { allEd = await sb.entities.Edificio.list('-updated_date', 5000); } catch { allEd = []; }
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

    // Activos existentes para dedup por code.
    let existing = [];
    try { existing = await sb.entities.Asset.list('-updated_date', 5000); } catch { existing = []; }
    const existingByCode = new Map();
    for (const a of existing) if (a.code) existingByCode.set(normalizeName(a.code), a);

    const parseErrors = [];
    const toCreate = [];
    const toUpdate = [];
    const sedesCreadas = [];
    let duplicados = 0;

    // Sede por defecto para todo el lote cuando el Excel no trae columna de
    // ubicación. Se crea una sola vez (lazy) y se reutiliza en todas las filas,
    // así la importación nunca aborta por "sin sede".
    let defaultSede = null;
    async function getDefaultSede() {
      if (defaultSede !== null) return defaultSede;
      const norm = normalizeName('Sede Principal');
      // Reutilizar si ya existe una con ese nombre en el sector.
      defaultSede = edByNorm.get(norm) || null;
      if (!defaultSede && auto_create_locations) {
        try {
          let ld = ldByNorm.get(norm);
          if (!ld) {
            ld = await sb.entities.LocationData.create({
              ubic_tecnica: 'sede-principal',
              establecimiento: 'Sede Principal',
              comuna: '10A',
              jefe_sitio: '',
              estado: 'activo',
            });
            ldByNorm.set(norm, ld);
          }
          const ed = await sb.entities.Edificio.create({
            nombre: 'Sede Principal',
            comuna: 'Otra',
            jefe_sitio: '',
            activo: true,
            location_id: ld.id,
          });
          edByNorm.set(norm, ed);
          edByLink.set(ld.id, ed);
          defaultSede = ed;
          sedesCreadas.push({ nombre: 'Sede Principal', locationdata_id: ld.id });
        } catch (e) {
          parseErrors.push(`Sede por defecto: no se pudo crear (${e.message})`);
          defaultSede = false; // marca fallo para no reintentar
        }
      }
      return defaultSede;
    }

    // Resolver/crear la sede de una fila → devuelve { location_id, sedeNombre }.
    // Resistente: si la creación falla para una sede, se registra el error y se
    // continúa (el activo se crea sin vínculo o con sede por defecto) en lugar de
    // abortar toda la importación.
    async function resolveSede(sedeRaw, comunaRaw, jefeRaw) {
      if (!sedeRaw) {
        const def = await getDefaultSede();
        return def ? { location_id: def.id, sedeNombre: def.nombre, created: false } : { location_id: null, sedeNombre: '', created: false };
      }
      const norm = normalizeName(sedeRaw);
      if (!norm) return { location_id: null, sedeNombre: '', created: false };

      let ed = edByNorm.get(norm) || null;
      let ld = ldByNorm.get(norm) || null;

      if (!ld && auto_create_locations) {
        const comuna = COMUNA_VALID.has(String(comunaRaw || '').toUpperCase()) ? String(comunaRaw).toUpperCase() : '10A';
        const ubic = (norm.slice(0, 45) || 'sede').padEnd(3, 'x');
        try {
          ld = await sb.entities.LocationData.create({
            ubic_tecnica: ubic,
            establecimiento: sedeRaw.slice(0, 200),
            comuna,
            jefe_sitio: jefeRaw || '',
            estado: 'activo',
          });
          ldByNorm.set(norm, ld);
          sedesCreadas.push({ nombre: sedeRaw, locationdata_id: ld.id });
        } catch (e) {
          parseErrors.push(`Sede "${sedeRaw}": no se creó ubicación (${e.message})`);
          ldByNorm.set(norm, false); // cachea fallo: no reintentar en filas siguientes
          ld = null;
        }
      }

      if (!ed && ld && auto_create_locations) {
        const payload = locationDataToEdificioPayload(ld);
        try {
          ed = await sb.entities.Edificio.create({
            nombre: payload.nombre,
            comuna: payload.comuna || 'Otra',
            jefe_sitio: payload.jefe_sitio,
            activo: payload.activo,
            location_id: ld.id,
          });
          edByNorm.set(norm, ed);
          edByLink.set(ld.id, ed);
        } catch (e) {
          parseErrors.push(`Sede "${sedeRaw}": no se creó edificio (${e.message})`);
          edByNorm.set(norm, false);
          ed = null;
        }
      }

      return {
        location_id: ed?.id || ld?.id || null,
        sedeNombre: ed?.nombre || ld?.establecimiento || sedeRaw,
        created: !!ld,
      };
    }

    for (let i = headerRowIdx + 1; i < raw.length; i++) {
      const row = raw[i];
      if (!row || row.length === 0) continue;
      const name = colName >= 0 && row[colName] ? String(row[colName]).trim() : null;
      if (!name) { parseErrors.push(`Fila ${i + 1}: sin nombre de activo`); continue; }

      // sede opcional: si falta, resolveSede usa una sede por defecto para el lote.
      const sedeRaw = colSede >= 0 && row[colSede] ? String(row[colSede]).trim() : '';

      const code = colCode >= 0 && row[colCode] ? String(row[colCode]).trim() : '';
      const comunaRaw = colComuna >= 0 && row[colComuna] ? String(row[colComuna]).trim() : '';
      const jefeRaw = colJefe >= 0 && row[colJefe] ? String(row[colJefe]).trim() : '';

      const { location_id, sedeNombre } = await resolveSede(sedeRaw, comunaRaw, jefeRaw);

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

    const BATCH = 25;
    let created = 0, updated = 0, errors = 0;
    const errorDetails = [];

    for (let b = 0; b < toCreate.length; b += BATCH) {
      const batch = toCreate.slice(b, b + BATCH);
      try {
        await sb.entities.Asset.bulkCreate(batch);
        created += batch.length;
      } catch (err) {
        for (const item of batch) {
          try { await sb.entities.Asset.create(item); created++; }
          catch (e2) { errors++; errorDetails.push(`Crear [${item.code || '?'}] ${item.name.slice(0,40)}: ${e2.message}`); }
        }
      }
    }
    for (let b = 0; b < toUpdate.length; b += BATCH) {
      const batch = toUpdate.slice(b, b + BATCH);
      try {
        await sb.entities.Asset.bulkUpdate(batch);
        updated += batch.length;
      } catch (err) {
        for (const item of batch) {
          try { await sb.entities.Asset.update(item.id, item); updated++; }
          catch (e2) { errors++; errorDetails.push(`Actualizar [${item.code}] id=${item.id}: ${e2.message}`); }
        }
      }
    }

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
      auto_create_locations,
    });
  } catch (err) {
    if (err instanceof SectorError) return Response.json({ error: err.message }, { status: err.status });
    console.error('importarActivosBapro error:', err);
    return Response.json({ error: `Error interno: ${err.message}`, imported: 0, created: 0, updated: 0, errors: 1 }, { status: 500 });
  }
}