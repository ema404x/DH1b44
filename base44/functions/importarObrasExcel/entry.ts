import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import * as XLSX from 'npm:xlsx@0.18.5';

function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  if (typeof val === 'number') {
    const date = new Date(Date.UTC(1900, 0, val - 1));
    return date.toISOString().split('T')[0];
  }
  const s = String(val).trim();
  // ISO datetime string like "2023-06-16 00:00:00"
  const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  // DD/MM/YYYY
  const dmyMatch = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2].padStart(2,'0')}-${dmyMatch[1].padStart(2,'0')}`;
  return null;
}

function mapEstado(estadoSap, detalle) {
  if (!estadoSap && !detalle) return 'pendiente';
  const s = String(estadoSap || '').toUpperCase();
  const d = String(detalle || '').toLowerCase();
  if (d.includes('certificado') || s.includes('APR2')) return 'completado';
  if (d.includes('en ejecución') || d.includes('ejecucion') || s.includes('AEJE')) return 'en_progreso';
  if (d.includes('cancelado') || s.includes('CANC')) return 'cancelado';
  if (s.includes('FINA')) return 'completado';
  return 'pendiente';
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { file_url } = await req.json();
  if (!file_url) return Response.json({ error: 'file_url requerido' }, { status: 400 });

  const res = await fetch(file_url);
  if (!res.ok) return Response.json({ error: 'No se pudo descargar el archivo' }, { status: 400 });

  const buffer = await res.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });

  // Buscar la hoja "Planilla principal"
  const sheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('planilla') || n.toLowerCase().includes('principal')) || workbook.SheetNames[0];
  const ws = workbook.Sheets[sheetName];

  // Leer como array de arrays para manejar el header en fila 1 (índice 1)
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });

  // Fila 1 (índice 1) contiene los headers reales
  // Columnas clave por índice:
  // 0=COMUNA, 1=DIRECCION, 2=ESTABLECIMIENTO, 3=TITULO OBRA, 4=MONTO BASE,
  // 7=Nº ORDEN SAP, 8=ESTADO SAP, 9=DETALLE, 11=PLAZO, 12=AI(inicio), 13=AR(fin),
  // 14=%AVANCE ACUM, 19=JEFE SITIO, 20=INSPECTOR, 21=SUPERVISOR

  // ── Parsear todas las filas válidas ─────────────────────────────────────────
  const projects = [];
  let lastComuna = '';
  for (let i = 2; i < raw.length; i++) {
    const row = raw[i];
    if (!row || row.length < 4) continue;

    const titulo = row[3] ? String(row[3]).trim() : null;
    if (!titulo) continue;

    // Comuna: normalizar (mayúsculas, sin espacios) y rellenar huecos —
    // las celdas combinadas dejan las filas siguientes con la comuna en blanco.
    const comunaRaw = row[0] ? String(row[0]).trim().toUpperCase().replace(/\s+/g, '') : '';
    const comuna = comunaRaw || lastComuna;
    if (comunaRaw) lastComuna = comunaRaw;

    const nroOrden = row[7] ? String(row[7]).trim() : null;
    const monto = row[4] ? parseFloat(row[4]) || 0 : 0;
    const avance = row[14] != null ? Math.round(parseFloat(row[14]) * 100) : 0;
    const plazo = row[11] ? parseInt(row[11]) || 0 : 0;
    const fechaInicio = parseDate(row[12]);
    const fechaFin = parseDate(row[13]);
    const estadoSap = row[8] ? String(row[8]).trim() : null;
    const detalle = row[9] ? String(row[9]).trim() : null;
    const jefeSitio = row[19] ? String(row[19]).trim() : null;
    const inspector = row[20] ? String(row[20]).trim() : null;
    const supervisor = row[21] ? String(row[21]).trim() : null;
    const direccion = row[1] ? String(row[1]).trim() : null;
    const establecimiento = row[2] ? String(row[2]).trim() : null;

    projects.push({
      name: titulo,
      code: nroOrden || null,
      type: 'obra_nueva',
      status: mapEstado(estadoSap, detalle),
      priority: 'media',
      progress: Math.min(100, avance),
      estimated_budget: monto,
      start_date: fechaInicio,
      end_date: fechaFin,
      address: direccion || null,
      client_name: establecimiento || null,
      notes: [
        `Comuna: ${comuna || '—'}`,
        jefeSitio ? `Jefe de Sitio: ${jefeSitio}` : null,
        inspector ? `Inspector: ${inspector}` : null,
        supervisor ? `Supervisor: ${supervisor}` : null,
        plazo > 0 ? `Plazo: ${plazo} días` : null,
        estadoSap ? `Estado SAP: ${estadoSap}` : null,
        detalle ? `Detalle: ${detalle}` : null,
      ].filter(Boolean).join(' | '),
    });
  }

  // ── Upsert por Nº Orden SAP: actualiza obras existentes y crea las nuevas ──
  // Evita duplicar la planilla al re-importar y mantiene los datos siempre actualizados.
  const deduped = new Map();
  const noCodeRows = [];
  for (const proj of projects) {
    const c = proj.code ? String(proj.code).trim() : '';
    if (c) deduped.set(c, proj); else noCodeRows.push(proj);
  }
  const finalList = [...deduped.values(), ...noCodeRows];

  let existing = [];
  try { existing = await base44.asServiceRole.entities.Project.list('id', 5000); } catch (_) {}
  const byCode = new Map();
  for (const p of existing) {
    const c = p.code ? String(p.code).trim() : '';
    if (c) byCode.set(c, p);
  }

  const toCreate = [];
  const toUpdate = [];
  for (const proj of finalList) {
    const c = proj.code ? String(proj.code).trim() : '';
    if (c && byCode.has(c)) toUpdate.push({ id: byCode.get(c).id, ...proj });
    else toCreate.push(proj);
  }

  const BATCH_SIZE = 500;
  let created = 0;
  let updated = 0;
  let errors = 0;
  const errorDetails = [];

  // Creaciones
  for (let b = 0; b < toCreate.length; b += BATCH_SIZE) {
    const batch = toCreate.slice(b, b + BATCH_SIZE);
    try {
      await base44.asServiceRole.entities.Project.bulkCreate(batch);
      created += batch.length;
    } catch (err) {
      for (let j = 0; j < batch.length; j++) {
        try { await base44.asServiceRole.entities.Project.create(batch[j]); created++; }
        catch (e2) { errors++; errorDetails.push(`Crear fila ${b + j + 3}: ${batch[j].name?.slice(0, 40)} — ${e2.message}`); }
      }
    }
  }

  // Actualizaciones
  for (let b = 0; b < toUpdate.length; b += BATCH_SIZE) {
    const batch = toUpdate.slice(b, b + BATCH_SIZE);
    try {
      await base44.asServiceRole.entities.Project.bulkUpdate(batch);
      updated += batch.length;
    } catch (err) {
      for (let j = 0; j < batch.length; j++) {
        try { await base44.asServiceRole.entities.Project.update(batch[j].id, batch[j]); updated++; }
        catch (e2) { errors++; errorDetails.push(`Actualizar ${batch[j].code}: ${e2.message}`); }
      }
    }
  }

  return Response.json({
    imported: created + updated,
    created,
    updated,
    errors,
    errorDetails: errorDetails.slice(0, 20),
  });
});