import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import * as XLSX from 'npm:xlsx@0.18.5';

// Sheets to skip (auxiliary/config sheets)
const SKIP_SHEETS = ['PARA FORMATO CONDICIONAL', 'ESC'];

// Parse DD.MM.YYYY or DD/MM/YYYY → YYYY-MM-DD
function parseDate(val) {
  if (!val) return null;
  const s = String(val).trim();
  const m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

// Normalize inspector name from sheet/cell
function normalizeName(s) {
  if (!s || s === '#N/A') return null;
  return String(s).trim().toUpperCase();
}

// Map clase_orden → tipo
function claseToTipo(clase) {
  if (!clase) return 'mantenimiento';
  const c = String(clase).toUpperCase();
  if (c.includes('OBR')) return 'obra';
  if (c.includes('INS')) return 'inspeccion';
  if (c.includes('EME') || c.includes('URG')) return 'emergencia';
  return 'mantenimiento';
}

// Map status SAP → estado interno
function statusToEstado(status) {
  if (!status) return 'pendiente';
  const s = String(status).toUpperCase();
  if (s === 'AEJE') return 'pendiente'; // A ejecutar
  if (s === 'EJER') return 'en_progreso';
  if (s === 'CIER' || s === 'CERR') return 'resuelto';
  if (s === 'CANC') return 'cancelado';
  return 'pendiente';
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { file_url, comuna, jefes_por_inspector } = await req.json();
  // jefes_por_inspector: { "CARLA DONINI": { nombre: "...", email: "..." }, ... }

  if (!file_url) return Response.json({ error: 'file_url requerido' }, { status: 400 });

  // Fetch and parse the Excel file
  const res = await fetch(file_url);
  if (!res.ok) return Response.json({ error: 'No se pudo descargar el archivo' }, { status: 400 });

  const buffer = await res.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });

  const results = [];
  let totalImported = 0;
  let totalErrors = 0;

  for (const sheetName of workbook.SheetNames) {
    if (SKIP_SHEETS.includes(sheetName.toUpperCase()) ||
        SKIP_SHEETS.some(s => sheetName.toUpperCase().includes(s))) {
      continue;
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

    if (!rows.length) continue;

    let imported = 0;
    let errors = 0;
    const errorDetails = [];

    for (const row of rows) {
      const nroOrden = row['N° DE ORDEN'] || row['N° DE ORDEN '] || row['NRO DE ORDEN'];
      const tareas = row['TAREAS A REALIZAR'] || row['TAREA'] || row['DESCRIPCION'];
      const inspector = normalizeName(row['INSPECTOR']);
      const ubicacion = row['UBICACIÓN'] || row['UBICACION'] || row['UBICACIÓN '];
      const establecimiento = row['ESTABLECIMIENTO'];

      // Skip empty / #N/A rows
      if (!nroOrden || !tareas || !inspector || inspector === '#N/A') continue;
      if (String(tareas).trim() === '' || String(nroOrden).trim() === '') continue;

      // Resolve jefe from inspector mapping
      const jefeInfo = jefes_por_inspector?.[inspector] || null;

      const record = {
        numero_sap: String(nroOrden).trim(),
        numero_sap_desaprobado: row['N° DE ORDEN 1° DESAPROBADO']
          ? String(row['N° DE ORDEN 1° DESAPROBADO']).trim()
          : null,
        descripcion: String(tareas).trim(),
        sitio: ubicacion ? String(ubicacion).trim() : null,
        establecimiento: establecimiento ? String(establecimiento).trim() : null,
        inspector: inspector,
        clase_orden: row['CLASE DE ORDEN'] ? String(row['CLASE DE ORDEN']).trim() : null,
        status_sap: row['STATUS'] ? String(row['STATUS']).trim() : null,
        comuna: comuna || null,
        tipo: claseToTipo(row['CLASE DE ORDEN']),
        estado: jefeInfo ? 'asignado' : statusToEstado(row['STATUS']),
        prioridad: 'media',
        jefe_sitio: jefeInfo?.nombre || null,
        jefe_sitio_email: jefeInfo?.email || null,
        fecha_emision_sap: parseDate(row['FECHA INICIO']),
        fecha_limite: parseDate(row['FECHA LIMITE SAP']),
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