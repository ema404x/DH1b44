import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import * as XLSX from 'npm:xlsx@0.18.5';


const TIPO_MAP = {
  'ESTUFAS': 'estufas',
  'RADIADORES': 'radiadores',
  'CONDUCTOS': 'conductos',
  'CALDERAS': 'calderas',
  'VRV': 'vrv',
  'VRV BAJO SILUETA': 'vrv_bajo_silueta',
  'AIRE ACONDICIONADO CALOR': 'aire_acondicionado_calor',
  'OTROS SISTEMAS DE CALEFACCION': 'otros',
};

const GRUPOS = [
  { tipo: 'estufas',                 cant: 3,  func: 4,  nofunc: 5  },
  { tipo: 'radiadores',              cant: 7,  func: 8,  nofunc: 9  },
  { tipo: 'conductos',               cant: 11, func: 12, nofunc: 13 },
  { tipo: 'calderas',                cant: 15, func: 16, nofunc: 17 },
  { tipo: 'vrv',                     cant: 19, func: 20, nofunc: 21 },
  { tipo: 'vrv_bajo_silueta',        cant: 23, func: 24, nofunc: 25 },
  { tipo: 'aire_acondicionado_calor',cant: 27, func: 28, nofunc: 29 },
  { tipo: 'otros',                   cant: 31, func: 32, nofunc: 33 },
];

function calcEstado(pct) {
  if (pct === null || pct === undefined) return 'normal';
  if (pct < 50) return 'critico';
  if (pct < 75) return 'alerta';
  if (pct < 90) return 'normal';
  return 'optimo';
}

function parseSheet(wb, sheetName, comunaDefault) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const records = [];
  let currentComuna = comunaDefault;
  let currentEscuela = null;
  let currentJefe = null;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => c === null || c === '')) continue;

    // Fila de cabecera secundaria (CANTIDAD, FUNCIONA...)
    if (row[3] === 'CANTIDAD' || String(row[3] || '').toUpperCase() === 'CANTIDAD') continue;

    const escuelaCruda = row[1] ? String(row[1]).trim() : currentEscuela;
    if (!escuelaCruda) continue;
    // Ignorar filas cuyo campo "escuela" es en realidad un nombre de comuna o cabecera
    const esNombreComuna = /^(COMUNA\s*)?(8A|8B|10A)$/i.test(escuelaCruda) ||
      /^(ESCUELA|ESTABLECIMIENTO|NOMBRE|JEFE|TOTAL|CANTIDAD)$/i.test(escuelaCruda);
    if (esNombreComuna) continue;
    const escuela = escuelaCruda;
    currentEscuela = escuela;

    // Solo cambiar comuna si la celda contiene explícitamente "8A", "8B" o "10A"
    if (row[0]) {
      const val = String(row[0]).replace(/^C/i, '').trim().toUpperCase();
      if (['8A', '8B', '10A'].includes(val)) currentComuna = val;
    }
    if (row[2]) currentJefe = String(row[2]).trim();

    for (const g of GRUPOS) {
      const cant = parseFloat(row[g.cant]);
      if (!cant || isNaN(cant) || cant <= 0) continue;

      const func   = Math.round(parseFloat(row[g.func])   || 0);
      const nofunc = Math.round(parseFloat(row[g.nofunc]) || 0);
      const cantInt = Math.round(cant);

      // Descartar filas donde cantidad existe pero funciona Y no_funciona son ambos 0
      // (son filas de subtotales o acumulados del Excel, no datos reales)
      if (func === 0 && nofunc === 0) continue;

      const pct = cantInt > 0 ? Math.round((func / cantInt) * 100) : 0;

      records.push({
        escuela: currentEscuela,
        jefe_sitio: currentJefe || '',
        comuna: currentComuna || comunaDefault,
        tipo_equipo: g.tipo,
        cantidad_total: cantInt,
        cantidad_funciona: func,
        cantidad_no_funciona: nofunc,
        porcentaje_operativo: pct,
        estado: calcEstado(pct),
        periodo: periodo || (() => {
          const d = new Date();
          return d.toLocaleString('es-AR', { month: 'long', year: 'numeric', timeZone: 'America/Buenos_Aires' })
            .replace(/^\w/, c => c.toUpperCase());
        })(),
        alerta_generada: false,
      });
    }
  }
  return records;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url, periodo, limpiar_anteriores } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url requerido' }, { status: 400 });

    // Descargar el archivo
    const res = await fetch(file_url);
    const buffer = await res.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });

    // Intentar nombres de hojas con y sin espacios
    const sheetNames = wb.SheetNames;
    const findSheet = (name) => sheetNames.find(s => s.trim().toUpperCase() === name.trim().toUpperCase()) || name;

    const allRecordsRaw = [
      ...parseSheet(wb, findSheet('COMUNA 8A'), '8A'),
      ...parseSheet(wb, findSheet('COMUNA 8B'), '8B'),
      ...parseSheet(wb, findSheet('COMUNA 10A'), '10A'),
    ];

    // Actualizar período si se indicó
    if (periodo) allRecordsRaw.forEach(r => r.periodo = periodo);

    // Unificar registros con la misma escuela+tipo_equipo+comune (por si una escuela aparece en múltiples filas)
    const unifyMap = {};
    for (const r of allRecordsRaw) {
      const key = `${r.escuela}||${r.tipo_equipo}||${r.comuna}||${r.periodo}`;
      if (!unifyMap[key]) {
        unifyMap[key] = { ...r };
      } else {
        unifyMap[key].cantidad_total += r.cantidad_total;
        unifyMap[key].cantidad_funciona += r.cantidad_funciona;
        unifyMap[key].cantidad_no_funciona += r.cantidad_no_funciona;
        const total = unifyMap[key].cantidad_total;
        const pct = total > 0 ? Math.round((unifyMap[key].cantidad_funciona / total) * 100) : 0;
        unifyMap[key].porcentaje_operativo = pct;
        unifyMap[key].estado = calcEstado(pct);
      }
    }
    const allRecords = Object.values(unifyMap);

    // SIEMPRE limpiar todos los registros del mismo período antes de insertar
    // Esto garantiza que no haya duplicados sin importar cuántas veces se reimporte
    if (allRecords.length > 0) {
      const periodoTarget = allRecords[0].periodo;
      let existing = [];
      try {
        existing = await base44.asServiceRole.entities.EquipamientoCalefaccion.filter({ periodo: periodoTarget });
      } catch (_) {}
      const DEL_BATCH = 50;
      for (let i = 0; i < existing.length; i += DEL_BATCH) {
        const batch = existing.slice(i, i + DEL_BATCH);
        await Promise.all(batch.map(e => base44.asServiceRole.entities.EquipamientoCalefaccion.delete(e.id)));
        if (i + DEL_BATCH < existing.length) await new Promise(r => setTimeout(r, 400));
      }
    }

    // Insertar en lotes de 50 usando bulkCreate con pausa entre lotes
    let created = 0;
    const BATCH = 50;
    for (let i = 0; i < allRecords.length; i += BATCH) {
      const batch = allRecords.slice(i, i + BATCH);
      await base44.asServiceRole.entities.EquipamientoCalefaccion.bulkCreate(batch);
      created += batch.length;
      if (i + BATCH < allRecords.length) await new Promise(r => setTimeout(r, 300));
    }

    // Generar alertas automáticas para equipos críticos
    const criticos = allRecords.filter(r => r.estado === 'critico' || r.estado === 'alerta');

    return Response.json({
      success: true,
      total_importados: created,
      criticos: criticos.length,
      por_estado: {
        critico: allRecords.filter(r => r.estado === 'critico').length,
        alerta: allRecords.filter(r => r.estado === 'alerta').length,
        normal: allRecords.filter(r => r.estado === 'normal').length,
        optimo: allRecords.filter(r => r.estado === 'optimo').length,
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});