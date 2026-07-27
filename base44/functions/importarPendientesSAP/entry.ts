import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import * as XLSX from 'npm:xlsx@0.18.5';

const SKIP_SHEETS = ['PARA FORMATO CONDICIONAL', 'ESC'];
const BATCH_SIZE = 50;

function parseDate(val) {
  if (!val) return null;

  // Si es número serial de Excel (ej: 45123)
  if (typeof val === 'number' || /^\d{5}$/.test(String(val).trim())) {
    const serial = typeof val === 'number' ? val : parseInt(val);
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

function detectFormat(comuna) {
  if (String(comuna).includes('8B')) return 'formato_8b';
  if (String(comuna).includes('10') || String(comuna).includes('10A')) return 'formato_10a';
  return 'formato_8a';
}

function parseRows8B(ws) {
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  if (!raw || raw.length < 1) return { rows: [], inspectors: new Set() };

  const records = [];
  const inspectors = new Set();

  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (!row || row.length < 4) continue;

    const nroOrden = row[4];
    const tareas = row[3] ? String(row[3]).trim() : null;

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

function parseRows10A(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
  const records = [];
  const inspectors = new Set();

  for (const row of rows) {
    const nroOrden = row['N° DE ORDEN'] || row['N° DE ORDEN '] || row['NRO DE ORDEN'];
    const tareas = row['TAREAS A REALIZAR'] || row['TAREAS A REALIZAR '] || row['TAREA'] || row['DESCRIPCION'];
    const ubicacion = row['UBICACIÓN'] || row['UBICACION'] || row['UBICACIÓN '];
    const establecimiento = row['ESTABLECIMIENTO'] || row['ESTABLECIMIENTO '];
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
  let totalSkipped = 0;

  // Pre-cargar LocationData y Direccion para resolución automática
  const sb = base44.asServiceRole;
  const [allLocations, allDirecciones, existingPendientes] = await Promise.all([
    sb.entities.LocationData.list('-created_date', 2000).catch(() => []),
    sb.entities.Direccion.list().catch(() => []),
    // Pre-cargar pendientes existentes de esta comuna para evitar duplicados por numero_sap
    base44.entities.Pendiente.filter({ comuna }, '-created_date', 2000).catch(() => []),
  ]);

  // Set de números SAP ya existentes — previene duplicados
  const existingSapNumbers = new Set(
    existingPendientes.map(p => p.numero_sap).filter(Boolean)
  );

  const norm = (s) => s ? String(s).trim().toUpperCase() : '';

  // Índices para búsqueda rápida de jefe_sitio e inspector
  const locByEstablecimiento = new Map();
  const locByUbicacion = new Map();
  for (const loc of allLocations) {
    if (loc.establecimiento) locByEstablecimiento.set(norm(loc.establecimiento), loc);
    if (loc.ubic_tecnica) locByUbicacion.set(norm(loc.ubic_tecnica), loc);
  }

  const dirByInspector = new Map();
  for (const d of allDirecciones) {
    if (d.inspector) dirByInspector.set(norm(d.inspector), d);
  }

  function resolveFromLocation(establecimiento, ubicacion, inspectorRaw) {
    let jefe_sitio = null;
    let inspector = inspectorRaw || null;

    let loc = null;
    if (establecimiento) loc = locByEstablecimiento.get(norm(establecimiento));
    if (!loc && ubicacion) loc = locByUbicacion.get(norm(ubicacion));
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
      parsedRows = parseRows8B(ws).rows;
    } else if (formato === 'formato_10a') {
      parsedRows = parseRows10A(ws).rows;
    } else {
      parsedRows = parseRows8A(ws).rows;
    }

    if (!parsedRows.length) continue;

    let skipped = 0;
    const recordsToCreate = [];

    for (const r of parsedRows) {
      const jefeManual = r.inspector ? (jefes_por_inspector?.[r.inspector] || null) : null;
      const autoResolved = resolveFromLocation(r.establecimiento, r.ubicacion, r.inspector);

      const jefe_sitio = jefeManual?.nombre || autoResolved.jefe_sitio || null;
      const jefe_sitio_email = jefeManual?.email || null;
      const inspector = autoResolved.inspector || r.inspector || null;

      const nroSap = r.nroOrden;

      // DEDUP: saltar si ya existe un pendiente con el mismo numero_sap en esta comuna
      if (nroSap && existingSapNumbers.has(nroSap)) {
        skipped++;
        continue;
      }

      const record = {
        numero_sap: nroSap,
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

      recordsToCreate.push(record);
      // Prevenir duplicados intra-lote
      if (nroSap) existingSapNumbers.add(nroSap);
    }

    // BULK CREATE en lotes de 50 — mucho más rápido que creates individuales
    let imported = 0;
    let errors = 0;
    const errorDetails = [];

    for (let i = 0; i < recordsToCreate.length; i += BATCH_SIZE) {
      const batch = recordsToCreate.slice(i, i + BATCH_SIZE);
      try {
        await base44.entities.Pendiente.bulkCreate(batch);
        imported += batch.length;
      } catch (batchErr) {
        // Fallback: intentar creates individuales para preservar el reporte de errores
        for (const rec of batch) {
          try {
            await base44.entities.Pendiente.create(rec);
            imported++;
          } catch (e) {
            errors++;
            if (errorDetails.length < 5) {
              errorDetails.push(`Orden ${rec.numero_sap}: ${e.message}`);
            }
          }
        }
      }
    }

    totalImported += imported;
    totalErrors += errors;
    totalSkipped += skipped;
    results.push({ sheet: sheetName, imported, errors, skipped, errorDetails });
  }

  return Response.json({ results, totalImported, totalErrors, totalSkipped });
});