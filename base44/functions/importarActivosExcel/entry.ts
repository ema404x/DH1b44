import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import * as XLSX from 'npm:xlsx@0.18.5';
import { createScopedClient, resolveCallerSector, SectorError } from "../../shared/sectorGuard.ts";

// Mapeo de strings del Excel a enums del schema Asset.
const TYPE_MAP = {
  'electrico': 'equipo_electrico', 'eléctrico': 'equipo_electrico', 'equipo_electrico': 'equipo_electrico',
  'mecanico': 'equipo_mecanico', 'mecánico': 'equipo_mecanico', 'equipo_mecanico': 'equipo_mecanico',
  'hvac': 'instalacion_hvac', 'climatizacion': 'instalacion_hvac', 'climatización': 'instalacion_hvac', 'instalacion_hvac': 'instalacion_hvac',
  'sanitario': 'instalacion_sanitaria', 'instalacion_sanitaria': 'instalacion_sanitaria', 'plomeria': 'instalacion_sanitaria',
  'estructura': 'estructura',
  'vehiculo': 'vehipo', 'vehículo': 'vehiculo',
  'herramienta': 'herramienta',
  'informatico': 'sistemas_informaticos', 'informático': 'sistemas_informaticos', 'sistemas_informaticos': 'sistemas_informaticos', 'computacion': 'sistemas_informaticos',
  'mobiliario': 'mobiliario', 'mobiliario': 'mobiliario',
  'seguridad': 'seguridad',
  'otro': 'otro',
};
const STATUS_MAP = {
  'operativo': 'operativo', 'operando': 'operativo', 'ok': 'operativo',
  'mantenimiento': 'en_mantenimiento', 'en_mantenimiento': 'en_mantenimiento', 'en mantenimiento': 'en_mantenimiento',
  'fuera_de_servicio': 'fuera_de_servicio', 'fuera de servicio': 'fuera_de_servicio', 'fuera servicio': 'fuera_de_servicio', 'roto': 'fuera_de_servicio',
  'baja': 'baja', 'dado de baja': 'baja',
};
const CRIT_MAP = {
  'baja': 'baja', 'media': 'media', 'alta': 'alta', 'critica': 'critica', 'crítica': 'critica',
};

function parseDate(val) {
  if (!val || val === null) return null;
  if (val instanceof Date) return val.toISOString().split('T')[0];
  if (typeof val === 'number') {
    const daysOffset = val > 59 ? val - 1 : val;
    const date = new Date(Date.UTC(1899, 11, 31 + daysOffset));
    if (date.getTime() < 0) return null;
    return date.toISOString().split('T')[0];
  }
  const s = String(val).trim();
  if (!s) return null;
  const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  const dmyMatch = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    const y = parseInt(dmyMatch[3], 10);
    if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > 2100) return null;
    return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  return null;
}

function normKey(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function mapEnum(value, map, fallback) {
  if (!value) return fallback;
  const k = normKey(value);
  if (map[k]) return map[k];
  const direct = String(value).toLowerCase().trim();
  return map[direct] || fallback;
}

// Encuentra el índice de columna por header normalizado (case/accent-insensitive).
function findHeaderIndex(headers, candidates) {
  const norms = headers.map(h => normKey(h));
  for (const c of candidates) {
    const cn = normKey(c);
    const idx = norms.findIndex(n => n === cn);
    if (idx >= 0) return idx;
  }
  // contains fallback
  for (const c of candidates) {
    const cn = normKey(c);
    const idx = norms.findIndex(n => n && n.includes(cn));
    if (idx >= 0) return idx;
  }
  return -1;
}

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

    // SSRF protection
    try {
      const urlObj = new URL(file_url);
      if (urlObj.protocol !== 'https:') return Response.json({ error: 'Solo HTTPS permitido' }, { status: 403 });
      const ALLOWED_HOSTS = ['media.base44.com', 'storage.googleapis.com'];
      if (!ALLOWED_HOSTS.some(h => urlObj.hostname === h || urlObj.hostname.endsWith('.' + h))) {
        return Response.json({ error: 'Dominio no permitido' }, { status: 403 });
      }
    } catch {
      return Response.json({ error: 'URL inválida' }, { status: 400 });
    }

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

    // Localizar fila de headers: la primera fila con varias celdas no vacías.
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(raw.length, 5); i++) {
      const filled = (raw[i] || []).filter(c => c !== null && String(c).trim() !== '').length;
      if (filled >= 3) { headerRowIdx = i; break; }
    }
    const headers = raw[headerRowIdx] || [];

    const colSede = findHeaderIndex(headers, ['sede', 'edificio', 'establecimiento']);
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
      if (s.nombre) sedeByName.set(normKey(s.nombre), s);
    }
    const sedeById = new Map(sedes.map(s => [s.id, s]));

    // Activos existentes para dedup por code.
    let existing = [];
    try { existing = await sb.entities.Asset.list('-updated_date', 500); } catch { existing = []; }
    const existingByCode = new Map();
    for (const a of existing) {
      if (a.code) existingByCode.set(normKey(a.code), a);
    }

    const parseErrors = [];
    const toCreate = [];
    const toUpdate = [];

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
        const match = sedeByName.get(normKey(sedeRaw));
        if (match) {
          location_id = match.id;
          sedeNombre = match.nombre;
        }
      }

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

      // Dedup por code (si existe), sino por name+tipo.
      let matchKey = null;
      if (code) matchKey = normKey(code);
      const existingAsset = matchKey ? existingByCode.get(matchKey) : null;
      if (existingAsset) {
        toUpdate.push({ id: existingAsset.id, ...asset });
      } else {
        toCreate.push(asset);
        if (code) existingByCode.set(matchKey, { id: 'pending', ...asset });
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
      sedesResueltas: sedes.length,
    });
  } catch (err) {
    if (err instanceof SectorError) return Response.json({ error: err.message }, { status: err.status });
    console.error('importarActivosExcel error:', err);
    return Response.json({ error: `Error interno: ${err.message}`, imported: 0, created: 0, updated: 0, errors: 1 }, { status: 500 });
  }
});