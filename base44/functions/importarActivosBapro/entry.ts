import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import * as XLSX from 'npm:xlsx@0.18.5';
import { createScopedClient, resolveCallerSector, SectorError } from '../../shared/sectorGuard.ts';
import { normalizeName, findHeaderIndex, findHeaderRow, assertAllowedFileUrl, SEDE_HEADERS } from '../../shared/excelImport.ts';
import { bulkImportAssets, makeSedeAliasKey } from '../../shared/assetBulkImport.ts';
import { importRoleError } from '../../shared/importGuard.ts';
import { parseBaproWorkbook } from '../../shared/baproExcelParse.ts';

// Importer masivo de Activos.
//   dry_run=true  → parsea + valida SIN escribir; devuelve preview.
//   dry_run=false → ejecuta el import real y persiste un registro
//                   ImportacionActivos (con snapshots para rollback).
// Sector bapro: acepta file_urls (máx 20), lee todas las hojas, detecta columnas
// por prioridad y admite sede_id. Otros sectores: lógica original (file_url).

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_FILES = 20;
const BAPRO_DEFAULT_SEDE = 'Sede Central';

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

function fileLabel(url: string) {
  const last = (url.split('?')[0].split('/').pop()) || 'import.xlsx';
  try { return decodeURIComponent(last); } catch { return last; }
}

async function readWorkbook(file_url: string) {
  const res = await fetch(file_url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new HttpError(400, `Descarga fallida: ${res.status}`);
  const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_FILE_SIZE) throw new HttpError(413, 'Archivo demasiado grande (máx 50MB)');
  const buffer = await res.arrayBuffer();
  if (buffer.byteLength === 0) throw new HttpError(400, 'Archivo vacío');
  if (buffer.byteLength > MAX_FILE_SIZE) throw new HttpError(413, 'Archivo demasiado grande (máx 50MB)');
  let workbook;
  try { workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true }); }
  catch (err) { throw new HttpError(400, `Formato Excel inválido: ${err.message}`); }
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) throw new HttpError(400, 'Workbook sin hojas');
  return workbook;
}

// ── Lógica original (sectores distintos de bapro) ───────────────────────
function parseLegacy(workbook) {
  const sheetName = workbook.SheetNames.find(n => /activ/i.test(n)) || workbook.SheetNames[0];
  const ws = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
  if (!raw || raw.length < 2) throw new HttpError(400, 'Planilla sin datos (requiere headers + filas)');

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
  return inputs;
}

// ── Lógica bapro: varios archivos, todas las hojas, sede_id ─────────────
async function parseBapro(sb, urls: string[], sede_id) {
  const edificios = await sb.entities.Edificio.list('-updated_date', 1000);
  let sedeElegida = null;
  if (sede_id) {
    sedeElegida = (edificios || []).find(e => e.id === sede_id);
    if (!sedeElegida) throw new HttpError(400, 'sede_id no válido: la sede no existe en tu sector');
  }
  const aliasKey = makeSedeAliasKey(BAPRO_DEFAULT_SEDE);
  const byKey = new Map();
  for (const e of edificios || []) {
    const n = normalizeName(e.nombre);
    if (n && !byKey.has(n)) byKey.set(n, e);
    const k = aliasKey(e.nombre);
    if (k && !byKey.has(k)) byKey.set(k, e);
  }
  const sheetSedeFor = (sheetName: string) => {
    const e = byKey.get(normalizeName(sheetName)) || byKey.get(aliasKey(sheetName));
    return e ? e.nombre : '';
  };

  const inputs = [], hojas = [], hojas_omitidas = [];
  const columnas_detectadas: Record<string, string> = {};
  for (const url of urls) {
    const workbook = await readWorkbook(url);
    const r = parseBaproWorkbook(XLSX, workbook, {
      archivo: fileLabel(url),
      sheetSedeFor,
      forceSede: sedeElegida ? sedeElegida.nombre : '',
      defaultLabel: BAPRO_DEFAULT_SEDE,
    });
    inputs.push(...r.inputs);
    hojas.push(...r.hojas);
    hojas_omitidas.push(...r.hojas_omitidas);
    for (const [k, v] of Object.entries(r.columnas)) if (!columnas_detectadas[k]) columnas_detectadas[k] = v as string;
  }
  return { inputs, hojas, hojas_omitidas, columnas_detectadas, sedeElegida };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    const roleErr = importRoleError(user);
    if (roleErr) return roleErr;
    const callerSector = resolveCallerSector(user);
    const sb = createScopedClient(base44, callerSector);
    const isBapro = callerSector === 'bapro';

    const body = await req.json().catch(() => ({}));
    const { file_url, file_urls, sede_id, auto_create_locations = true, dry_run = false } = body;

    // URLs a procesar: bapro admite file_urls (máx 20); el resto solo file_url.
    let urls: string[] = [];
    if (isBapro && Array.isArray(file_urls) && file_urls.length > 0) urls = file_urls;
    else if (file_url && typeof file_url === 'string') urls = [file_url];
    if (urls.length === 0) return Response.json({ error: 'file_url requerido' }, { status: 400 });
    if (urls.length > MAX_FILES) return Response.json({ error: `Máximo ${MAX_FILES} archivos por lote` }, { status: 400 });
    for (const u of urls) {
      if (typeof u !== 'string') return Response.json({ error: 'file_url inválido' }, { status: 400 });
      try { assertAllowedFileUrl(u); }
      catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
    }

    let inputs;
    let extra: any = {};
    let opts: any = { autoCreateLocations: auto_create_locations, dryRun: dry_run };
    if (isBapro) {
      const parsed = await parseBapro(sb, urls, typeof sede_id === 'string' && sede_id ? sede_id : null);
      inputs = parsed.inputs;
      if (inputs.length === 0) {
        return Response.json({
          error: 'No se encontraron filas con nombre/descripción en ninguna hoja',
          hojas_omitidas: parsed.hojas_omitidas,
        }, { status: 400 });
      }
      extra = { columnas_detectadas: parsed.columnas_detectadas, hojas: parsed.hojas, hojas_omitidas: parsed.hojas_omitidas, sede_elegida: parsed.sedeElegida ? parsed.sedeElegida.nombre : null };
      opts = { ...opts, defaultSede: BAPRO_DEFAULT_SEDE, sedeAliases: true, strictSede: true };
    } else {
      inputs = parseLegacy(await readWorkbook(urls[0]));
    }

    const result = await bulkImportAssets(sb, inputs, opts);

    // ── Modo dry-run: devolver preview ──────────────────────────────────
    if (dry_run) {
      return Response.json({ ok: true, sector: callerSector, tipo: 'excel', ...extra, ...result });
    }

    // ── Modo real: persistir registro de importación ────────────────────
    let importacion_id = null;
    try {
      const reg = await sb.entities.ImportacionActivos.create({
        file_name: urls.map(fileLabel).join(', ').slice(0, 200) || 'import.xlsx',
        tipo: 'excel',
        total_filas: result.total_filas,
        created_ids: result.created_ids,
        updated_ids: result.updated_ids,
        updated_snapshots: result.updated_snapshots,
        snapshot_completo: result.snapshot_completo,
        sedes_creadas_ids: result.sedes_creadas_ids,
        estado: 'ejecutada',
        created: result.created,
        updated: result.updated,
      });
      importacion_id = reg.id;
    } catch (e) {
      // El import ya se ejecutó; si falla el registro, el rollback no estará
      // disponible pero los datos sí quedaron importados.
      console.error('ImportacionActivos create failed:', e.message);
    }

    return Response.json({
      ok: true,
      sector: callerSector,
      tipo: 'excel',
      importacion_id,
      imported: result.created + result.updated,
      created: result.created,
      updated: result.updated,
      errors: result.errors,
      errorDetails: result.errorDetails.slice(0, 20),
      duplicados: result.duplicados,
      sedes_creadas: result.sedes_creadas,
      snapshot_completo: result.snapshot_completo,
      auto_create_locations,
    });
  } catch (err) {
    if (err instanceof HttpError) return Response.json({ error: err.message }, { status: err.status });
    if (err instanceof SectorError) return Response.json({ error: err.message }, { status: err.status });
    console.error('importarActivosBapro error:', err);
    return Response.json({ error: `Error interno: ${err.message}`, imported: 0, created: 0, updated: 0, errors: 1 }, { status: 500 });
  }
}