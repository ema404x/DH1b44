import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import * as XLSX from 'npm:xlsx@0.18.5';

function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().split('T')[0];
  if (typeof val === 'number') {
    const d = new Date(Date.UTC(1900, 0, val - 1));
    return d.toISOString().split('T')[0];
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

// Clave de unicidad: Nº Orden + título normalizado.
// Así las obras que comparten Nº Orden pero tienen distinto título NO se colapsan.
function normTitle(t) { return String(t || '').trim().toUpperCase().replace(/\s+/g, ' '); }
function keyOf(code, name) {
  const c = code ? String(code).trim() : '';
  const n = normTitle(name);
  return c ? `${c}::${n}` : `NULL::${n}`;
}

// Parsea la planilla y devuelve el array de obras (mismos campos que importarObrasExcel)
function parsePlanilla(buffer) {
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });
  const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('planilla') || n.toLowerCase().includes('principal')) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });

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
    const avance = row[14] != null ? Math.round(parseFloat(row[14]) * 100) : 0;
    const plazo = row[11] ? parseInt(row[11]) || 0 : 0;
    const estadoSap = row[8] ? String(row[8]).trim() : null;
    const detalle = row[9] ? String(row[9]).trim() : null;
    const jefeSitio = row[19] ? String(row[19]).trim() : null;
    const inspector = row[20] ? String(row[20]).trim() : null;
    const supervisor = row[21] ? String(row[21]).trim() : null;
    const direccion = row[1] ? String(row[1]).trim() : null;
    const establecimiento = row[2] ? String(row[2]).trim() : null;

    rows.push({
      name: titulo,
      code: nroOrden || null,
      type: 'obra_nueva',
      status: mapEstado(estadoSap, detalle),
      priority: 'media',
      progress: Math.min(100, avance),
      estimated_budget: monto,
      start_date: parseDate(row[12]),
      end_date: parseDate(row[13]),
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
  return rows;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url, fix = false } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url requerido' }, { status: 400 });

    const res = await fetch(file_url);
    if (!res.ok) return Response.json({ error: 'No se pudo descargar el archivo' }, { status: 400 });
    const buffer = await res.arrayBuffer();

    const rows = parsePlanilla(buffer);

    // ── Cargar obras existentes ──
    let existing = [];
    try { existing = await base44.asServiceRole.entities.Project.list('id', 10000); } catch (_) {}

    const systemKeys = new Set();
    for (const p of existing) systemKeys.add(keyOf(p.code, p.name));

    // ── Estadísticas de la planilla ──
    let planillaTotal = 0;
    let sinCodigo = 0;
    const codeCount = new Map(); // code -> repeticiones
    const seenKeys = new Set();   // code+title vistos (dedupe verdadero)
    const faltantes = [];         // en planilla, no en sistema
    const sincronizados = [];     // en planilla y en sistema

    for (const r of rows) {
      planillaTotal++;
      if (!r.code) sinCodigo++;
      else codeCount.set(r.code, (codeCount.get(r.code) || 0) + 1);

      const k = keyOf(r.code, r.name);
      if (seenKeys.has(k)) continue; // duplicado real (mismo código + mismo título)
      seenKeys.add(k);

      if (systemKeys.has(k)) sincronizados.push(r);
      else faltantes.push(r);
    }

    const codigosUnicos = codeCount.size;
    const duplicadosCodigo = [...codeCount.entries()]
      .filter(([, c]) => c > 1)
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count);
    const filasConCodigoRepetido = [...codeCount.values()].reduce((s, c) => s + (c > 1 ? c : 0), 0);

    // ── Huérfanos: en sistema pero no en la planilla ──
    const sheetKeys = new Set(rows.map(r => keyOf(r.code, r.name)));
    const huerfanos = existing
      .filter(p => !sheetKeys.has(keyOf(p.code, p.name)) && p.code)
      .map(p => ({ id: p.id, name: p.name, code: p.code || '—' }));

    // ── Modo corrección: crear las obras faltantes ──
    if (fix) {
      let created = 0;
      let errors = 0;
      for (let b = 0; b < faltantes.length; b += 500) {
        const batch = faltantes.slice(b, b + 500);
        try {
          await base44.asServiceRole.entities.Project.bulkCreate(batch);
          created += batch.length;
        } catch (_) {
          for (const it of batch) {
            try { await base44.asServiceRole.entities.Project.create(it); created++; }
            catch (e2) { errors++; }
          }
        }
      }
      return Response.json({
        planillaTotal,
        enSistema: existing.length,
        faltantesCount: faltantes.length,
        created,
        errors,
        huerfanosCount: huerfanos.length,
      });
    }

    return Response.json({
      planillaTotal,
      enSistema: existing.length,
      sinCodigo,
      codigosUnicos,
      filasConCodigoRepetido,
      duplicadosCodigoCount: duplicadosCodigo.length,
      duplicadosCodigo: duplicadosCodigo.slice(0, 50),
      sincronizadosCount: sincronizados.length,
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
    return Response.json({ error: err.message }, { status: 500 });
  }
});