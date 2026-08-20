import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import * as XLSX from 'npm:xlsx@0.18.5';
import { createScopedClient, resolveCallerSector, SectorError } from "../../shared/sectorGuard.ts";
import { normalizeName, parseDate, mapEnum, findHeaderIndex, findHeaderRow, assertAllowedFileUrl, TYPE_MAP, STATUS_MAP, CRIT_MAP, SEDE_HEADERS } from "../../shared/excelImport.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: solo admin' }, { status: 403 });

    const callerSector = resolveCallerSector(user);
    const sb = createScopedClient(base44, callerSector);

    const body = await req.json().catch(() => ({}));
    const { file_url } = body;
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
    const colArea = findHeaderIndex(headers, ['area', 'área', 'zona', 'sector', 'departamento']);
    const colJefe = findHeaderIndex(headers, ['jefe', 'jefe de sitio', 'responsable']);
    const colStatus = findHeaderIndex(headers, ['estado', 'status']);
    const colCrit = findHeaderIndex(headers, ['criticidad', 'critic', 'prioridad']);
    const colLoc = findHeaderIndex(headers, ['ubicacion', 'ubicación', 'ubicacion detallada', 'ubicación detallada', 'location']);
    const colCost = findHeaderIndex(headers, ['costo', 'costo adquisicion', 'costo de adquisicion', 'valor']);
    const colPurchase = findHeaderIndex(headers, ['fecha compra', 'compra', 'fecha de compra', 'purchase date']);
    const colWarranty = findHeaderIndex(headers, ['garantia', 'garantía', 'garantia hasta', 'garantía hasta', 'vence garantia']);
    const colLastM = findHeaderIndex(headers, ['ultimo mantenimiento', 'último mantenimiento', 'ult mant', 'ultimo mant']);
    const colNextM = findHeaderIndex(headers, ['proximo mantenimiento', 'próximo mantenimiento', 'prox mant', 'proximo mant']);
    const colFreq = findHeaderIndex(headers, ['frecuencia', 'frecuencia (dias)', 'frecuencia (días)']);
    const colNotes = findHeaderIndex(headers, ['notas', 'observaciones', 'obs']);

    // Cargar sedes (Edificio) del sector para resolver location_id por nombre.
    let sedes = [];
    try { sedes = await sb.entities.Edificio.list('-updated_date', 500); } catch { sedes = []; }
    const sedeByName = new Map();
    for (const s of sedes) {
      if (s.nombre) sedeByName.set(normalizeName(s.nombre), s);
    }
    const sedeById = new Map(sedes.map(s => [s.id, s]));

    // Activos existentes para dedup por code.
    let existing = [];
    try { existing = await sb.entities.Asset.list('-updated_date', 500); } catch { existing = []; }
    const existingByCode = new Map();
    for (const a of existing) {
      if (a.code) existingByCode.set(normalizeName(a.code), a);
    }

    const parseErrors = [];
    const toCreate = [];
    const toUpdate = [];
    let duplicados = 0;

    for (let i = headerRowIdx + 1; i < raw.length; i++) {
      const row = raw[i];
      if (!row || row.length === 0) continue;
      const name = colName >= 0 && row[colName] ? String(row[colName]).trim() : null;
      if (!name) continue; // sin nombre no es válido

      const code = colCode >= 0 && row[colCode] ? String(row[colCode]).trim() : '';
      const sedeRaw = colSede >= 0 && row[colSede] ? String(row[colSede]).trim() : '';

      // Resolver location_id por nombre de sede.
      let location_id = null;
      let sedeNombre = sedeRaw;
      if (sedeRaw) {
        const match = sedeByName.get(normalizeName(sedeRaw));
        if (match) {
          location_id = match.id;
          sedeNombre = match.nombre;
        }
      }

      const tipo = colType >= 0 && row[colType] ? mapEnum(row[colType], TYPE_MAP, 'otro') : 'otro';
      const estado = colStatus >= 0 && row[colStatus] ? mapEnum(row[colStatus], STATUS_MAP, 'operativo') : 'operativo';
      const criticidad = colCrit >= 0 && row[colCrit] ? mapEnum(row[colCrit], CRIT_MAP, 'media') : 'media';

      const asset = {
        sector_id: callerSector,
        name: name.slice(0, 255),
        code: code ? code.slice(0, 100) : '',
        type: tipo,
        brand: colBrand >= 0 && row[colBrand] ? String(row[colBrand]).trim().slice(0, 100) : '',
        model: colModel >= 0 && row[colModel] ? String(row[colModel]).trim().slice(0, 100) : '',
        serial_number: colSerial >= 0 && row[colSerial] ? String(row[colSerial]).trim().slice(0, 100) : '',
        location_id,
        sede: sedeNombre || '',
        area: colArea >= 0 && row[colArea] ? String(row[colArea]).trim().slice(0, 100) : '',
        jefe_sitio: colJefe >= 0 && row[colJefe] ? String(row[colJefe]).trim().slice(0, 100) : '',
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

      // Dedup por code contra DB existente y contra filas ya procesadas del mismo archivo.
      const matchKey = code ? normalizeName(code) : null;
      const existingAsset = matchKey ? existingByCode.get(matchKey) : null;
      if (existingAsset && existingAsset.id && existingAsset.id !== 'pending') {
        // Existe en DB → actualizar.
        toUpdate.push({ id: existingAsset.id, ...asset });
      } else if (existingAsset && existingAsset.id === 'pending') {
        // Duplicado dentro del mismo Excel → ignorar (ya se creó arriba).
        duplicados++;
      } else {
        toCreate.push(asset);
        if (matchKey) existingByCode.set(matchKey, { id: 'pending', ...asset });
      }
    }

    const BATCH = 500;
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
      imported: created + updated,
      created,
      updated,
      errors,
      errorDetails: errorDetails.slice(0, 20),
      duplicados,
      sedesResueltas: sedes.length,
    });
  } catch (err) {
    if (err instanceof SectorError) return Response.json({ error: err.message }, { status: err.status });
    console.error('importarActivosExcel error:', err);
    return Response.json({ error: `Error interno: ${err.message}`, imported: 0, created: 0, updated: 0, errors: 1 }, { status: 500 });
  }
});