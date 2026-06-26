import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import * as XLSX from 'npm:xlsx@0.18.5';

function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().split('T')[0];
  if (typeof val === 'number') {
    const daysOffset = val > 59 ? val - 1 : val;
    const date = new Date(Date.UTC(1899, 11, 31 + daysOffset));
    if (date.getTime() < 0) return null;
    return date.toISOString().split('T')[0];
  }
  const s = String(val).trim();
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
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

function normTitle(t) { return String(t || '').trim().toUpperCase().replace(/\s+/g, ' '); }
function keyOf(code, name) {
  const c = code ? String(code).trim() : '';
  const n = normTitle(name);
  if (!n) return null;
  return c ? `${c}::${n}` : `NULL::${n}`;
}

// MISMO parser que importarObrasExcel — debe estar sincronizado
function parsePlanilla(buffer) {
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });
  const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('planilla') || n.toLowerCase().includes('principal')) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
  if (!raw || raw.length < 3) return [];

  const rows = [];
  let lastComuna = '';
  for (let i = 2; i < raw.length; i++) {
    const row = raw[i];
    if (!row || row.length < 4) continue;
    const titulo = row[3] ? String(row[3]).trim() : null;
    if (!titulo) continue;

    const comunaRaw = row[0] ? String(row[0]).trim().toUpperCase().replace(/\s+/g, '') : '';
    const comuna = comunaRaw || lastComuna;
    if (comunaRaw) lastComuna = comunaRaw;

    const nroOrden = row[7] ? String(row[7]).trim() : null;
    const monto = row[4] ? parseFloat(row[4]) || 0 : 0;

    // MISMO fix que importarObrasExcel: > 1 → porcentaje directo, < 1 → multiplicar x100
    let avance = 0;
    if (row[14] != null) {
      const parsed = parseFloat(row[14]);
      if (!isNaN(parsed)) {
        avance = parsed > 1 ? Math.round(parsed) : Math.round(parsed * 100);
        avance = Math.max(0, Math.min(100, avance));
      }
    }

    const plazo = row[11] ? parseInt(row[11], 10) || 0 : 0;
    const estadoSap = row[8] ? String(row[8]).trim() : null;
    const detalle = row[9] ? String(row[9]).trim() : null;
    const jefeSitio = row[19] ? String(row[19]).trim() : null;
    const inspector = row[20] ? String(row[20]).trim() : null;
    const supervisor = row[21] ? String(row[21]).trim() : null;
    const direccion = row[1] ? String(row[1]).trim() : null;
    const establecimiento = row[2] ? String(row[2]).trim() : null;

    const notes = [
      `Comuna: ${comuna || '—'}`,
      jefeSitio ? `Jefe de Sitio: ${jefeSitio.slice(0, 100)}` : null,
      inspector ? `Inspector: ${inspector.slice(0, 100)}` : null,
      supervisor ? `Supervisor: ${supervisor.slice(0, 100)}` : null,
      plazo > 0 ? `Plazo: ${plazo} días` : null,
      estadoSap ? `Estado SAP: ${estadoSap.slice(0, 50)}` : null,
      detalle ? `Detalle: ${detalle.slice(0, 200)}` : null,
    ].filter(Boolean).join(' | ');

    rows.push({
      name: titulo.slice(0, 255),
      code: nroOrden || null,
      type: 'obra_nueva',
      status: mapEstado(estadoSap, detalle),
      priority: 'media',
      progress: avance,
      estimated_budget: Math.max(0, monto),
      start_date: parseDate(row[12]),
      end_date: parseDate(row[13]),
      address: (direccion || '').slice(0, 255) || null,
      client_name: (establecimiento || '').slice(0, 255) || null,
      notes: notes.slice(0, 2000),
    });
  }
  return rows;
}

// Carga TODOS los proyectos del sistema con paginación real (máx 5000 por request)
async function loadAllProjects(base44) {
  const all = [];
  let skip = 0;
  const PAGE = 5000;
  while (true) {
    const chunk = await base44.asServiceRole.entities.Project.list('id', PAGE, skip);
    all.push(...chunk);
    if (chunk.length < PAGE) break;
    skip += PAGE;
  }
  return all;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url, fix = false } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url requerido' }, { status: 400 });

    const res = await fetch(file_url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) return Response.json({ error: `Descarga fallida: ${res.status}` }, { status: 400 });
    const buffer = await res.arrayBuffer();

    const rows = parsePlanilla(buffer);
    if (!rows.length) return Response.json({ error: 'Planilla sin filas válidas' }, { status: 400 });

    // Cargar TODOS los proyectos existentes con paginación correcta
    const existing = await loadAllProjects(base44);

    const systemKeys = new Set();
    for (const p of existing) {
      const k = keyOf(p.code, p.name);
      if (k) systemKeys.add(k);
    }

    // Deduplicar la planilla (igual que importarObrasExcel)
    const deduped = new Map();
    for (const r of rows) {
      const k = keyOf(r.code, r.name);
      if (k) deduped.set(k, r);
    }
    const uniqueRows = [...deduped.values()];

    let sinCodigo = 0;
    const codeCount = new Map();
    const faltantes = [];

    for (const r of uniqueRows) {
      if (!r.code) sinCodigo++;
      else codeCount.set(r.code, (codeCount.get(r.code) || 0) + 1);

      const k = keyOf(r.code, r.name);
      if (!systemKeys.has(k)) faltantes.push(r);
    }

    const codigosUnicos = codeCount.size;
    const duplicadosCodigo = [...codeCount.entries()]
      .filter(([, c]) => c > 1)
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count);
    const filasConCodigoRepetido = [...codeCount.values()].reduce((s, c) => s + (c > 1 ? c : 0), 0);

    // Huérfanos: en sistema pero no en planilla
    const sheetKeys = new Set(uniqueRows.map(r => keyOf(r.code, r.name)).filter(Boolean));
    const huerfanos = existing
      .filter(p => { const k = keyOf(p.code, p.name); return k && !sheetKeys.has(k) && p.code; })
      .map(p => ({ id: p.id, name: p.name, code: p.code || '—' }));

    // Modo corrección: UPSERT completo (crear faltantes + actualizar todos)
    if (fix) {
      let created = 0;
      let updated = 0;
      let errors = 0;

      // Separar crear vs actualizar
      const toCreate = [];
      const toUpdate = [];
      for (const r of uniqueRows) {
        const k = keyOf(r.code, r.name);
        if (!k) continue;
        if (systemKeys.has(k)) {
          const match = existing.find(p => keyOf(p.code, p.name) === k);
          if (match) toUpdate.push({ id: match.id, ...r });
        } else {
          toCreate.push(r);
        }
      }

      // Crear faltantes en batches
      for (let b = 0; b < toCreate.length; b += 500) {
        const batch = toCreate.slice(b, b + 500);
        try {
          await base44.asServiceRole.entities.Project.bulkCreate(batch);
          created += batch.length;
        } catch (_) {
          for (const it of batch) {
            try { await base44.asServiceRole.entities.Project.create(it); created++; }
            catch (e2) { errors++; console.error('create error:', e2.message); }
          }
        }
      }

      // Actualizar existentes en batches
      for (let b = 0; b < toUpdate.length; b += 500) {
        const batch = toUpdate.slice(b, b + 500);
        try {
          await base44.asServiceRole.entities.Project.bulkUpdate(batch);
          updated += batch.length;
        } catch (_) {
          for (const it of batch) {
            try { await base44.asServiceRole.entities.Project.update(it.id, it); updated++; }
            catch (e2) { errors++; console.error('update error:', e2.message); }
          }
        }
      }

      return Response.json({
        planillaTotal: rows.length,
        uniqueTotal: uniqueRows.length,
        enSistema: existing.length,
        faltantesCount: faltantes.length,
        created,
        updated,
        errors,
        huerfanosCount: huerfanos.length,
      });
    }

    return Response.json({
      planillaTotal: rows.length,
      uniqueTotal: uniqueRows.length,
      enSistema: existing.length,
      sinCodigo,
      codigosUnicos,
      filasConCodigoRepetido,
      duplicadosCodigoCount: duplicadosCodigo.length,
      duplicadosCodigo: duplicadosCodigo.slice(0, 50),
      sincronizadosCount: uniqueRows.length - faltantes.length,
      faltantesCount: faltantes.length,
      faltantes: faltantes.slice(0, 200).map(r => ({
        name: r.name,
        code: r.code || '—',
        comuna: (r.notes.match(/Comuna:\s*([^|]+)/) || [])[1]?.trim() || '—',
        address: r.address || '—',
        client_name: r.client_name || '—',
      })),
      huerfanosCount: huerfanos.length,
      huerfanos: huerfanos.slice(0, 100),
    });
  } catch (err) {
    console.error('auditarObrasSincronizacion error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});