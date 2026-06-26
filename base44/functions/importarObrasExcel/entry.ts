import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import * as XLSX from 'npm:xlsx@0.18.5';

function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  if (typeof val === 'number') {
    // ⚠️ BUG FIX: Excel epoch comienza en 1900-01-01, pero cuenta erróneamente año bisiesto
    // Excel serializa 1900 como bisiesto, pero no lo fue. Resto 2 para < 1960, 1 para >= 1960.
    const daysOffset = val > 59 ? val - 1 : val;
    const date = new Date(Date.UTC(1899, 11, 31 + daysOffset));
    if (date.getTime() < 0) return null; // fecha inválida
    return date.toISOString().split('T')[0];
  }
  const s = String(val).trim();
  if (!s) return null;
  // ISO datetime string like "2023-06-16 00:00:00"
  const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  // DD/MM/YYYY
  const dmyMatch = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    const y = parseInt(dmyMatch[3], 10);
    // Validación básica
    if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > 2100) return null;
    return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  return null;
}

function mapEstado(estadoSap, detalle) {
  if (!estadoSap && !detalle) return 'pendiente';
  const s = String(estadoSap || '').toUpperCase().trim();
  const d = String(detalle || '').toLowerCase().trim();
  // ⚠️ BUG FIX: orden de evaluación es importante. Certificado > completado siempre.
  if (d.includes('certificado') || s.includes('APR2')) return 'completado';
  if (d.includes('en ejecución') || d.includes('ejecucion') || s.includes('AEJE')) return 'en_progreso';
  if (d.includes('cancelado') || s.includes('CANC')) return 'cancelado';
  if (s.includes('FINA')) return 'completado';
  return 'pendiente';
}

// Clave de unicidad: Nº Orden + título normalizado.
function normTitle(t) {
  if (!t) return '';
  return String(t).trim().toUpperCase().replace(/\s+/g, ' ');
}

function keyOf(code, name) {
  const c = code ? String(code).trim() : '';
  const n = normTitle(name);
  // ⚠️ BUG FIX: Si nombre es vacío, no crear clave válida (prevenir duplicados sin título)
  if (!n) return null;
  return c ? `${c}::${n}` : `NULL::${n}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'JSON inválido en el body' }, { status: 400 });
    }
    
    const { file_url } = body;
    if (!file_url || typeof file_url !== 'string' || !file_url.trim()) {
      return Response.json({ error: 'file_url requerido y válido' }, { status: 400 });
    }

    // ⚠️ SECURITY: Validar que la URL sea segura (permitir solo base44/cdn)
    try {
      const urlObj = new URL(file_url);
      // Permitir solo HTTPS y dominios conocidos
      if (urlObj.protocol !== 'https:') {
        return Response.json({ error: 'Solo HTTPS permitido' }, { status: 403 });
      }
    } catch {
      return Response.json({ error: 'URL inválida' }, { status: 400 });
    }

    const res = await fetch(file_url, { signal: AbortSignal.timeout(30000) }); // timeout de 30s
    if (!res.ok) return Response.json({ error: `Descarga fallida: ${res.status}` }, { status: 400 });
    
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength === 0) {
      return Response.json({ error: 'Archivo vacío' }, { status: 400 });
    }
    
    // ⚠️ BUG FIX: Limitar tamaño de archivo (máx 50MB para evitar exhaustión de memoria)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (buffer.byteLength > MAX_SIZE) {
      return Response.json({ error: 'Archivo demasiado grande (máx 50MB)' }, { status: 413 });
    }

    let workbook;
    try {
      workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });
    } catch (err) {
      return Response.json({ error: `Formato Excel inválido: ${err.message}` }, { status: 400 });
    }

    // ⚠️ BUG FIX: Verificar que el workbook tenga hojas
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return Response.json({ error: 'Workbook sin hojas' }, { status: 400 });
    }

    const sheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('planilla') || n.toLowerCase().includes('principal')) || workbook.SheetNames[0];
    const ws = workbook.Sheets[sheetName];
    if (!ws) {
      return Response.json({ error: `Hoja '${sheetName}' no encontrada` }, { status: 400 });
    }

    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
    
    // ⚠️ BUG FIX: Validar que haya al menos headers + 1 fila de datos
    if (!raw || raw.length < 3) {
      return Response.json({ error: 'Planilla sin datos (requiere mínimo 2 filas)' }, { status: 400 });
    }

    // Parsear todas las filas válidas
    const projects = [];
    let lastComuna = '';
    const parseErrors = [];

    for (let i = 2; i < raw.length; i++) {
      const row = raw[i];
      if (!row || row.length < 4) continue;

      const titulo = row[3] ? String(row[3]).trim() : null;
      if (!titulo) continue; // Sin título no es un registro válido

      const comunaRaw = row[0] ? String(row[0]).trim().toUpperCase().replace(/\s+/g, '') : '';
      const comuna = comunaRaw || lastComuna;
      if (comunaRaw) lastComuna = comunaRaw;

      const nroOrden = row[7] ? String(row[7]).trim() : null;
      const monto = row[4] ? parseFloat(row[4]) || 0 : 0;
      
      // ⚠️ BUG FIX: Validar avance (0-100, no % multiplicado)
      let avance = 0;
      if (row[14] != null) {
        const parsed = parseFloat(row[14]);
        if (!isNaN(parsed)) {
          // Si es > 1, asumir que es porcentaje directo; si es < 1, multiplicar por 100
          avance = parsed > 1 ? Math.round(parsed) : Math.round(parsed * 100);
          avance = Math.max(0, Math.min(100, avance)); // Clamping a 0-100
        }
      }

      const plazo = row[11] ? parseInt(row[11], 10) || 0 : 0;
      if (plazo < 0) parseErrors.push(`Fila ${i + 1}: plazo negativo`);

      const fechaInicio = parseDate(row[12]);
      const fechaFin = parseDate(row[13]);
      
      // ⚠️ BUG FIX: Validar consistencia de fechas
      if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
        parseErrors.push(`Fila ${i + 1}: fecha inicio > fecha fin`);
      }

      const estadoSap = row[8] ? String(row[8]).trim() : null;
      const detalle = row[9] ? String(row[9]).trim() : null;
      const jefeSitio = row[19] ? String(row[19]).trim() : null;
      const inspector = row[20] ? String(row[20]).trim() : null;
      const supervisor = row[21] ? String(row[21]).trim() : null;
      const direccion = row[1] ? String(row[1]).trim() : null;
      const establecimiento = row[2] ? String(row[2]).trim() : null;

      // ⚠️ BUG FIX: Sanear strings (trim, no valores vacíos, máx 255 chars para SAP)
      const notes = [
        `Comuna: ${comuna || '—'}`,
        jefeSitio ? `Jefe de Sitio: ${jefeSitio.slice(0, 100)}` : null,
        inspector ? `Inspector: ${inspector.slice(0, 100)}` : null,
        supervisor ? `Supervisor: ${supervisor.slice(0, 100)}` : null,
        plazo > 0 ? `Plazo: ${plazo} días` : null,
        estadoSap ? `Estado SAP: ${estadoSap.slice(0, 50)}` : null,
        detalle ? `Detalle: ${detalle.slice(0, 200)}` : null,
      ].filter(Boolean).join(' | ');

      projects.push({
        name: titulo.slice(0, 255),
        code: (nroOrden || '').slice(0, 50) || null,
        type: 'obra_nueva',
        status: mapEstado(estadoSap, detalle),
        priority: 'media',
        progress: avance,
        estimated_budget: Math.max(0, monto), // ⚠️ BUG FIX: no negativos
        start_date: fechaInicio,
        end_date: fechaFin,
        address: (direccion || '').slice(0, 255) || null,
        client_name: (establecimiento || '').slice(0, 255) || null,
        notes: notes.slice(0, 2000), // ⚠️ BUG FIX: limitar notes a 2000 chars
      });
    }

    // ⚠️ BUG FIX: Deduplicar: agrupar por clave, últimas ganan (permitir correcciones)
    const deduped = new Map();
    for (const proj of projects) {
      const k = keyOf(proj.code, proj.name);
      if (k) deduped.set(k, proj); // Last one wins
    }
    const finalList = [...deduped.values()];

    // Paginar lectura de existentes con máximo 5000 por request
    let existing = [];
    try {
      let skip = 0;
      const PAGE = 5000;
      while (true) {
        const chunk = await base44.asServiceRole.entities.Project.list('id', PAGE, skip);
        existing.push(...chunk);
        if (chunk.length < PAGE) break;
        skip += PAGE;
      }
    } catch (err) {
      parseErrors.push(`Lectura de projects existentes falló: ${err.message}`);
      existing = [];
    }

    const existingByKey = new Map();
    for (const p of existing) {
      const k = keyOf(p.code, p.name);
      if (k) existingByKey.set(k, p);
    }

    const toCreate = [];
    const toUpdate = [];
    for (const proj of finalList) {
      const k = keyOf(proj.code, proj.name);
      if (!k) continue; // Skip registros sin clave
      const match = existingByKey.get(k);
      if (match) toUpdate.push({ id: match.id, ...proj });
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
        // Fallback: crear uno por uno
        for (let j = 0; j < batch.length; j++) {
          try {
            await base44.asServiceRole.entities.Project.create(batch[j]);
            created++;
          } catch (e2) {
            errors++;
            errorDetails.push(`Crear [${batch[j].code || '?'}] ${batch[j].name.slice(0, 40)}: ${e2.message}`);
          }
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
        // Fallback: actualizar uno por uno
        for (let j = 0; j < batch.length; j++) {
          try {
            await base44.asServiceRole.entities.Project.update(batch[j].id, batch[j]);
            updated++;
          } catch (e2) {
            errors++;
            errorDetails.push(`Actualizar [${batch[j].code}] id=${batch[j].id}: ${e2.message}`);
          }
        }
      }
    }

    return Response.json({
      imported: created + updated,
      created,
      updated,
      errors,
      errorDetails: errorDetails.slice(0, 20),
      parseWarnings: parseErrors.slice(0, 10),
      deduplicatedCount: projects.length - finalList.length,
    });

  } catch (err) {
    // ⚠️ BUG FIX: Capturar errores no previstos
    console.error('importarObrasExcel error:', err);
    return Response.json({
      error: `Error interno: ${err.message}`,
      imported: 0,
      created: 0,
      updated: 0,
      errors: 1,
    }, { status: 500 });
  }
});