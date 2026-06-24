import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import * as XLSX from 'npm:xlsx@0.18.5';

const SKIP_SHEETS = ['PARA FORMATO CONDICIONAL', 'ESC'];

function parseDate(val) {
  if (!val) return null;

  // Si es número serial de Excel (ej: 45123)
  if (typeof val === 'number' || /^\d{5}$/.test(String(val).trim())) {
    const serial = typeof val === 'number' ? val : parseInt(val);
    // Excel epoch real: 30 dic 1899 = serial 0 (incluye bug del 29/feb/1900 ficticio)
    const date = new Date(Date.UTC(1899, 11, 30 + serial));
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Formato texto DD/MM/YYYY o DD-MM-YYYY o DD.MM.YYYY
  const s = String(val).trim();
  const match = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (!match) return null;
  const [, d, mo, y] = match;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function normalizeName(s) {
  if (!s || s === '#N/A') return null;
  return String(s).trim().toUpperCase();
}

function claseToTipo(clase) {
  if (!clase) return 'mantenimiento';
  const c = String(clase).toUpperCase();
  if (c.includes('OBR')) return 'obra';
  if (c.includes('INS')) return 'inspeccion';
  if (c.includes('EME') || c.includes('URG')) return 'emergencia';
  return 'mantenimiento';
}

function statusToEstado(status) {
  if (!status) return 'pendiente';
  const s = String(status).toUpperCase();
  if (s === 'AEJE') return 'pendiente';
  if (s === 'EJER') return 'en_progreso';
  if (s === 'CIER' || s === 'CERR') return 'resuelto';
  if (s === 'CANC') return 'cancelado';
  return 'pendiente';
}

/**
 * Detect the format of the Excel file based on the commune.
 * - '8A': multiple sheets per inspector, has INSPECTOR column, FECHA LIMITE SAP
 * - '8B': single sheet "PENDIENTES 8B", no INSPECTOR column — inspector name IS the column header,
 *         columns: [inspector_name, ubicacion, descripcion, nro_orden, col_4, col_5, fecha_inicio, fecha_limite, clase, status]
 * - '10A': single sheet "PENDIENTES C10A", no INSPECTOR column, FECHA LIMITE (no SAP suffix)
 */
function detectFormat(comuna) {
  if (String(comuna).includes('8B')) return 'formato_8b';
  if (String(comuna).includes('10') || String(comuna).includes('10A')) return 'formato_10a';
  return 'formato_8a'; // default (8A, multiple sheets with INSPECTOR column)
}

/**
 * Parse rows from formato_8b sheet.
 * The sheet has NO proper headers — xlsx reads row 0 as headers.
 * Column layout (positional, by index):
 *   0: inspector name (the column header is the inspector's name)
 *   1: ubicacion
 *   2: descripcion (TAREAS A REALIZAR)
 *   3: N° DE ORDEN
 *   4: (col extra / vacía)
 *   5: (col extra / vacía)
 *   6: FECHA INICIO
 *   7: FECHA LIMITE
 *   8: CLASE DE ORDEN
 *   9: STATUS
 */
function parseRows8B(ws) {
  // Read as array of arrays — fila 0 del Excel es la primera fila real de datos
  // (el xlsx la interpreta como header ficticio, por eso usamos header:1 y empezamos desde índice 0)
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  if (!raw || raw.length < 1) return { rows: [], inspectors: new Set() };

  const records = [];
  const inspectors = new Set();

  // Estructura columnas 8B:
  // 0=inspector, 1=ubicacion, 2=ubicacion2(dup), 3=tareas, 4=nro_orden, 5=col_vacia, 6=fecha_inicio, 7=fecha_limite, 8=clase_orden, 9=status
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (!row || row.length < 4) continue;

    const nroOrden = row[4];
    const tareas = row[3] ? String(row[3]).trim() : null;

    // Saltar filas sin orden válida o sin tarea
    if (!nroOrden || !tareas || tareas === '') continue;
    const nroStr = String(nroOrden).trim();
    if (nroStr === '' || isNaN(Number(nroStr))) continue;

    const inspector = normalizeName(row[0]);
    const ubicacion = row[1] ? String(row[1]).trim() : null;
    const fechaInicio = row[6];
    const fechaLimite = row[7];
    const claseOrden = row[8] ? String(row[8]).trim() : null;
    const status = row[9] ? String(row[9]).trim() : null;

    if (inspector) inspectors.add(inspector);

    records.push({
      inspector,
      ubicacion,
      tareas,
      nroOrden: nroStr,
      desaprobado: null,
      fechaInicio,
      fechaLimite,
      claseOrden,
      status,
    });
  }

  return { rows: records, inspectors };
}

/**
 * Parse rows from formato_10a (no INSPECTOR column).
 * Columns: UBICACIÓN, ESTABLECIMIENTO, TAREAS A REALIZAR , N° DE ORDEN, 1° DESROBADO, FECHA INICIO, FECHA LIMITE, CLASE DE ORDEN, STATUS
 * Also reads INSPECTOR column if present (some 10A files do include it).
 */
function parseRows10A(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
  const records = [];
  const inspectors = new Set();

  for (const row of rows) {
    const nroOrden = row['N° DE ORDEN'] || row['N° DE ORDEN '] || row['NRO DE ORDEN'];
    const tareas = row['TAREAS A REALIZAR'] || row['TAREAS A REALIZAR '] || row['TAREA'] || row['DESCRIPCION'];
    const ubicacion = row['UBICACIÓN'] || row['UBICACION'] || row['UBICACIÓN '];
    const establecimiento = row['ESTABLECIMIENTO'] || row['ESTABLECIMIENTO '];
    // "1° DESROBADO" is a typo for "1° DESAPROBADO" in the 10A format
    const desaprobado = row['1° DESROBADO'] || row['1° DESAPROBADO'] || row['N° DE ORDEN 1° DESAPROBADO'];
    const fechaLimite = row['FECHA LIMITE'] || row['FECHA LÍMITE'] || row['FECHA LIMITE SAP'];
    const inspector = normalizeName(row['INSPECTOR'] || row['INSPECTOR ']);

    if (!nroOrden || !tareas || String(tareas).trim() === '') continue;
    if (inspector) inspectors.add(inspector);

    records.push({
      inspector: inspector || null,
      ubicacion: ubicacion ? String(ubicacion).trim() : null,
      establecimiento: establecimiento ? String(establecimiento).trim() : null,
      tareas: String(tareas).trim(),
      nroOrden: String(nroOrden).trim(),
      desaprobado: desaprobado ? String(desaprobado).trim() : null,
      fechaInicio: row['FECHA INICIO'],
      fechaLimite,
      claseOrden: row['CLASE DE ORDEN'] ? String(row['CLASE DE ORDEN']).trim() : null,
      status: row['STATUS'] ? String(row['STATUS']).trim() : null,
    });
  }

  return { rows: records, inspectors };
}

/**
 * Parse rows from formato_8a (standard, with INSPECTOR column).
 */
function parseRows8A(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
  const records = [];
  const inspectors = new Set();

  for (const row of rows) {
    const inspector = normalizeName(row['INSPECTOR']);
    const nroOrden = row['N° DE ORDEN'] || row['N° DE ORDEN '] || row['NRO DE ORDEN'];
    const tareas = row['TAREAS A REALIZAR'] || row['TAREAS A REALIZAR '] || row['TAREA'] || row['DESCRIPCION'];

    if (!nroOrden || !tareas || String(tareas).trim() === '') continue;
    if (!inspector || inspector === '#N/A') continue;

    inspectors.add(inspector);
    records.push({
      inspector,
      ubicacion: (row['UBICACIÓN'] || row['UBICACION'] || row['UBICACIÓN '] || '') ? String(row['UBICACIÓN'] || row['UBICACION'] || '').trim() : null,
      establecimiento: row['ESTABLECIMIENTO'] ? String(row['ESTABLECIMIENTO']).trim() : null,
      tareas: String(tareas).trim(),
      nroOrden: String(nroOrden).trim(),
      desaprobado: row['N° DE ORDEN 1° DESAPROBADO'] ? String(row['N° DE ORDEN 1° DESAPROBADO']).trim() : null,
      fechaInicio: row['FECHA INICIO'],
      fechaLimite: row['FECHA LIMITE SAP'] || row['FECHA LIMITE'] || row['FECHA LÍMITE'],
      claseOrden: row['CLASE DE ORDEN'] ? String(row['CLASE DE ORDEN']).trim() : null,
      status: row['STATUS'] ? String(row['STATUS']).trim() : null,
    });
  }

  return { rows: records, inspectors };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { file_url, comuna, jefes_por_inspector } = await req.json();
  if (!file_url) return Response.json({ error: 'file_url requerido' }, { status: 400 });

  const res = await fetch(file_url);
  if (!res.ok) return Response.json({ error: 'No se pudo descargar el archivo' }, { status: 400 });

  const buffer = await res.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });

  const formato = detectFormat(comuna);
  const results = [];
  let totalImported = 0;
  let totalErrors = 0;

  // Pre-cargar LocationData y Direccion para resolución automática (especialmente 10A)
  const sb = base44.asServiceRole;
  const [allLocations, allDirecciones] = await Promise.all([
    sb.entities.LocationData.list('-created_date', 2000).catch(() => []),
    sb.entities.Direccion.list().catch(() => []),
  ]);

  const norm = (s) => s ? String(s).trim().toUpperCase() : '';

  // Construir índices para búsqueda rápida
  // LocationData: establecimiento → { jefe_sitio, inspector }
  const locByEstablecimiento = new Map();
  const locByUbicacion = new Map();
  for (const loc of allLocations) {
    if (loc.establecimiento) locByEstablecimiento.set(norm(loc.establecimiento), loc);
    if (loc.ubic_tecnica) locByUbicacion.set(norm(loc.ubic_tecnica), loc);
  }

  // Direccion: inspector → jefe_sitio
  const dirByInspector = new Map();
  for (const d of allDirecciones) {
    if (d.inspector) dirByInspector.set(norm(d.inspector), d);
  }

  // Resolver jefe_sitio e inspector a partir de establecimiento/ubicacion
  function resolveFromLocation(establecimiento, ubicacion, inspectorRaw) {
    let jefe_sitio = null;
    let inspector = inspectorRaw || null;

    // 1. Buscar en LocationData por establecimiento o ubicacion técnica
    let loc = null;
    if (establecimiento) loc = locByEstablecimiento.get(norm(establecimiento));
    if (!loc && ubicacion) loc = locByUbicacion.get(norm(ubicacion));
    // Búsqueda parcial si no hubo exacta
    if (!loc && establecimiento) {
      const normEst = norm(establecimiento);
      for (const [k, v] of locByEstablecimiento) {
        if (k.includes(normEst) || normEst.includes(k)) { loc = v; break; }
      }
    }

    if (loc) {
      if (loc.jefe_sitio) jefe_sitio = loc.jefe_sitio;
      if (!inspector && loc.inspector) inspector = loc.inspector;
    }

    // 2. Fallback: si hay inspector pero no jefe, buscar en Direccion
    if (!jefe_sitio && inspector) {
      const dir = dirByInspector.get(norm(inspector));
      if (dir?.jefe_sitio) jefe_sitio = dir.jefe_sitio;
    }

    return { jefe_sitio, inspector };
  }

  for (const sheetName of workbook.SheetNames) {
    const upperSheet = sheetName.toUpperCase();
    if (SKIP_SHEETS.some(s => upperSheet.includes(s))) continue;

    const ws = workbook.Sheets[sheetName];
    let parsedRows = [];

    if (formato === 'formato_8b') {
      const parsed = parseRows8B(ws);
      parsedRows = parsed.rows;
    } else if (formato === 'formato_10a') {
      const parsed = parseRows10A(ws);
      parsedRows = parsed.rows;
    } else {
      // formato_8a
      const parsed = parseRows8A(ws);
      parsedRows = parsed.rows;
    }

    if (!parsedRows.length) continue;

    let imported = 0;
    let errors = 0;
    const errorDetails = [];

    for (const r of parsedRows) {
      // Jefe asignado manualmente (desde el frontend, por inspector)
      const jefeManual = r.inspector ? (jefes_por_inspector?.[r.inspector] || null) : null;

      // Resolución automática desde LocationData/Direccion (usada especialmente para 10A)
      const autoResolved = resolveFromLocation(r.establecimiento, r.ubicacion, r.inspector);

      // Prioridad: manual > automático
      const jefe_sitio = jefeManual?.nombre || autoResolved.jefe_sitio || null;
      const jefe_sitio_email = jefeManual?.email || null;
      const inspector = autoResolved.inspector || r.inspector || null;

      const record = {
        numero_sap: r.nroOrden,
        numero_sap_desaprobado: r.desaprobado || null,
        descripcion: r.tareas,
        sitio: r.ubicacion || null,
        establecimiento: r.establecimiento || r.ubicacion || null,
        inspector,
        clase_orden: r.claseOrden || null,
        status_sap: r.status || null,
        comuna: comuna || null,
        tipo: claseToTipo(r.claseOrden),
        estado: jefe_sitio ? 'asignado' : statusToEstado(r.status),
        prioridad: 'media',
        jefe_sitio,
        jefe_sitio_email,
        fecha_emision_sap: parseDate(r.fechaInicio),
        fecha_limite: parseDate(r.fechaLimite),
      };

      try {
        await base44.entities.Pendiente.create(record);
        imported++;
      } catch (err) {
        errors++;
        errorDetails.push(`Orden ${record.numero_sap}: ${err.message}`);
      }
    }

    totalImported += imported;
    totalErrors += errors;
    results.push({ sheet: sheetName, imported, errors, errorDetails: errorDetails.slice(0, 5) });
  }

  return Response.json({ results, totalImported, totalErrors });
});