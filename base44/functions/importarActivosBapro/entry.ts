import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import * as XLSX from 'npm:xlsx@0.18.5';
import { createScopedClient, resolveCallerSector, SectorError } from '../../shared/sectorGuard.ts';
import { normalizeName, mapEnum, findHeaderIndex, findHeaderRow, assertAllowedFileUrl, SEDE_HEADERS } from '../../shared/excelImport.ts';
import { bulkImportAssets } from '../../shared/assetBulkImport.ts';

// Importer masivo de Activos BAPRO con auto-creación de ubicaciones.
//
// La lógica de resolución de sedes + bulkCreate/bulkUpdate vive ahora en
// base44/shared/assetBulkImport.ts (compartida con importarActivosPDF).
// Acá queda solo el parse del Excel → array de inputs crudos que se le pasa
// al helper compartido.

const MAX_FILE_SIZE = 50 * 1024 * 1024;

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

    const hasSedeCol = colSede >= 0;

    // ── Construir inputs crudos para el helper compartido ───────────────
    const inputs = [];
    for (let i = headerRowIdx + 1; i < raw.length; i++) {
      const row = raw[i];
      if (!row || row.length === 0) continue;
      const name = colName >= 0 && row[colName] ? String(row[colName]).trim() : null;
      if (!name) continue;
      inputs.push({
        name,
        code: colCode >= 0 && row[colCode] ? String(row[colCode]).trim() : '',
        type: colType >= 0 && row[colType] ? String(row[colType]).trim() : '',
        brand: colBrand >= 0 && row[colBrand] ? String(row[colBrand]).trim() : '',
        model: colModel >= 0 && row[colModel] ? String(row[colModel]).trim() : '',
        serial_number: colSerial >= 0 && row[colSerial] ? String(row[colSerial]).trim() : '',
        sede: hasSedeCol && row[colSede] ? String(row[colSede]).trim() : '',
        area: colArea >= 0 && row[colArea] ? String(row[colArea]).trim() : '',
        jefe_sitio: colJefe >= 0 && row[colJefe] ? String(row[colJefe]).trim() : '',
        comuna: colComuna >= 0 && row[colComuna] ? String(row[colComuna]).trim() : '',
        status: colStatus >= 0 && row[colStatus] ? String(row[colStatus]).trim() : '',
        criticality: colCrit >= 0 && row[colCrit] ? String(row[colCrit]).trim() : '',
        location: colLoc >= 0 && row[colLoc] ? String(row[colLoc]).trim() : '',
        purchase_cost: colCost >= 0 && row[colCost] ? row[colCost] : 0,
        purchase_date: colPurchase >= 0 && row[colPurchase] ? String(row[colPurchase]).trim() : '',
        warranty_expiry: colWarranty >= 0 && row[colWarranty] ? String(row[colWarranty]).trim() : '',
        last_maintenance: colLastM >= 0 && row[colLastM] ? String(row[colLastM]).trim() : '',
        next_maintenance: colNextM >= 0 && row[colNextM] ? String(row[colNextM]).trim() : '',
        maintenance_frequency_days: colFreq >= 0 && row[colFreq] ? row[colFreq] : 90,
        notes: colNotes >= 0 && row[colNotes] ? String(row[colNotes]).trim() : '',
      });
    }

    const result = await bulkImportAssets(sb, inputs, { autoCreateLocations: auto_create_locations });

    return Response.json({
      ok: true,
      sector: callerSector,
      imported: result.created + result.updated,
      created: result.created,
      updated: result.updated,
      errors: result.errors,
      errorDetails: result.errorDetails.slice(0, 20),
      duplicados: result.duplicados,
      filas_invalidas: result.parseErrors.length,
      parseErrors: result.parseErrors.slice(0, 20),
      sedes_creadas: result.sedes_creadas,
      sedes_creadas_detalle: result.sedes_creadas_detalle,
      sedes_totales_unicas: result.sedes_totales_unicas,
      sedes_preexistentes: result.sedes_preexistentes,
      auto_create_locations,
    });
  } catch (err) {
    if (err instanceof SectorError) return Response.json({ error: err.message }, { status: err.status });
    console.error('importarActivosBapro error:', err);
    return Response.json({ error: `Error interno: ${err.message}`, imported: 0, created: 0, updated: 0, errors: 1 }, { status: 500 });
  }
}