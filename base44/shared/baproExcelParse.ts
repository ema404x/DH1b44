// base44/shared/baproExcelParse.ts
//
// Parser de Excel para la importación masiva de activos de BAPRO.
// Detecta la fila de encabezados y las columnas por reglas de prioridad, sin
// asignar una misma columna a dos campos. Solo lo usa importarActivosBapro
// (sector bapro); el resto de los sectores conserva su lógica propia.

import { resolverTipoBapro } from './baproTipos.ts';

const nz = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const hasToken = (h, c) => (' ' + h + ' ').includes(' ' + c + ' ');

type Field = { key: string; cands: string[]; ignore: string[] };
const f = (key: string, cands: string[], ignore: string[] = []): Field => ({ key, cands: cands.map(nz), ignore: ignore.map(nz) });

// Orden = prioridad de asignación: sede, código, nombre y luego el resto.
const FIELDS: Field[] = [
  f('sede', ['sucursal', 'sede', 'suc', 'filial', 'dependencia', 'edificio', 'oficina'],
    ['direccion', 'dirección', 'domicilio', 'calle', 'ubicacion', 'ubicación', 'localidad', 'lugar', 'postal', 'codigo', 'cod', 'nro', 'numero', 'n', 'id']),
  f('code', ['codigo', 'cod', 'code', 'inventario', 'n° inventario', 'nro inventario', 'nº inventario', 'patrimonio', 'n° patrimonio', 'legajo', 'etiqueta', 'tag', 'id activo', 'nro de bien', 'numero de bien'],
    ['postal', 'sucursal']),
  f('name', ['descripcion', 'detalle', 'nombre del bien', 'bien', 'equipo', 'articulo', 'nombre', 'activo', 'name'],
    ['sucursal', 'sede', 'tipo', 'codigo', 'código']),
  f('type', ['tipo', 'type', 'rubro', 'categoria', 'categoría', 'clase', 'familia', 'tipo de bien', 'especialidad']),
  f('brand', ['marca', 'brand']),
  f('model', ['modelo', 'model']),
  f('serial_number', ['serie', 'serial', 'n serie', 'nro serie', 'numero de serie']),
  f('area', ['area', 'zona', 'departamento']),
  f('jefe_sitio', ['jefe de sitio', 'jefe', 'responsable']),
  f('comuna', ['comuna']),
  f('status', ['estado', 'status']),
  f('criticality', ['criticidad', 'critic', 'prioridad']),
  f('location', ['ubicacion detallada', 'ubicacion', 'lugar', 'piso', 'sector', 'location']),
  f('purchase_cost', ['costo adquisicion', 'costo', 'valor']),
  f('purchase_date', ['fecha compra', 'compra', 'purchase date']),
  f('warranty_expiry', ['vence garantia', 'garantia']),
  f('last_maintenance', ['ultimo mantenimiento', 'ult mant']),
  f('next_maintenance', ['proximo mantenimiento', 'prox mant']),
  f('maintenance_frequency_days', ['frecuencia dias', 'frecuencia']),
  f('notes', ['notas', 'observaciones', 'obs']),
];

const isIgnored = (h, fld: Field) => fld.ignore.some(i => hasToken(h, i));

function findCol(hs: string[], fld: Field, used: Set<number>) {
  for (const c of fld.cands) {
    const i = hs.findIndex((h, k) => h && !used.has(k) && h === c && !isIgnored(h, fld));
    if (i >= 0) return i;
  }
  for (const c of fld.cands) {
    const i = hs.findIndex((h, k) => h && !used.has(k) && hasToken(h, c) && !isIgnored(h, fld));
    if (i >= 0) return i;
  }
  return -1;
}

// Asigna columnas en orden de prioridad; cada columna se usa una sola vez.
export function resolveCols(headerRow) {
  const hs = (headerRow || []).map(nz);
  const used = new Set<number>();
  const cols: Record<string, number> = {};
  for (const fld of FIELDS) {
    const i = findCol(hs, fld, used);
    cols[fld.key] = i;
    if (i >= 0) used.add(i);
  }
  return cols;
}

// De las primeras 15 filas, elige la que reconoce más encabezados conocidos.
export function pickHeaderRow(raw) {
  let best = -1, bestScore = 0;
  for (let i = 0; i < Math.min(raw.length, 15); i++) {
    const hs = (raw[i] || []).map(nz).filter(h => h && h.length <= 40);
    const score = hs.filter(h => FIELDS.some(fld => fld.cands.some(c => h === c || hasToken(h, c)))).length;
    if (score > bestScore) { best = i; bestScore = score; }
  }
  return { idx: best, score: bestScore };
}

const str = (v) => (v === null || v === undefined ? '' : String(v).trim());

export type ParseOpts = {
  archivo: string;
  sheetSedeFor: (sheetName: string) => string; // sede según nombre de hoja ('' si no coincide)
  forceSede?: string;                           // sede elegida: gana sobre columna y hoja
  defaultLabel: string;
};

// Lee TODAS las hojas del libro. Devuelve filas mapeadas, columnas detectadas
// (campo → encabezado original), hojas leídas y hojas omitidas.
export function parseBaproWorkbook(XLSX, workbook, opts: ParseOpts) {
  const inputs: any[] = [];
  const hojas: any[] = [];
  const hojas_omitidas: any[] = [];
  const columnas: Record<string, string> = {};

  for (const sheetName of workbook.SheetNames || []) {
    const ws = workbook.Sheets[sheetName];
    const raw = ws ? XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false }) : [];
    const omit = (motivo) => hojas_omitidas.push({ archivo: opts.archivo, hoja: sheetName, motivo });
    if (!raw || raw.length < 2) { omit('Hoja vacía'); continue; }
    const { idx, score } = pickHeaderRow(raw);
    if (idx < 0 || score === 0) { omit('Sin encabezados reconocidos'); continue; }
    const headerRow = raw[idx] || [];
    const c = resolveCols(headerRow);
    if (c.name < 0) { omit('Sin columna de nombre o descripción'); continue; }

    const sheetSede = opts.forceSede || opts.sheetSedeFor(sheetName) || '';
    const cell = (row, k) => (k >= 0 ? str(row[k]) : '');
    const rawCell = (row, k, dflt) => (k >= 0 && row[k] !== null && row[k] !== undefined && row[k] !== '' ? row[k] : dflt);
    let filas = 0;
    for (let i = idx + 1; i < raw.length; i++) {
      const row = raw[i];
      if (!row || row.length === 0) continue;
      const name = cell(row, c.name);
      if (!name) continue;
      inputs.push({
        name,
        code: cell(row, c.code),
        type: resolverTipoBapro(cell(row, c.type), name),
        brand: cell(row, c.brand),
        model: cell(row, c.model),
        serial_number: cell(row, c.serial_number),
        sede: opts.forceSede || cell(row, c.sede) || sheetSede,
        area: cell(row, c.area),
        jefe_sitio: cell(row, c.jefe_sitio),
        comuna: cell(row, c.comuna),
        status: cell(row, c.status),
        criticality: cell(row, c.criticality),
        location: cell(row, c.location),
        purchase_cost: rawCell(row, c.purchase_cost, 0),
        purchase_date: rawCell(row, c.purchase_date, ''),
        warranty_expiry: rawCell(row, c.warranty_expiry, ''),
        last_maintenance: rawCell(row, c.last_maintenance, ''),
        next_maintenance: rawCell(row, c.next_maintenance, ''),
        maintenance_frequency_days: rawCell(row, c.maintenance_frequency_days, 90),
        notes: cell(row, c.notes),
      });
      filas++;
    }
    for (const [k, col] of Object.entries(c)) {
      if (col >= 0 && !columnas[k]) columnas[k] = str(headerRow[col]);
    }
    hojas.push({ archivo: opts.archivo, hoja: sheetName, filas, sede_por_defecto: sheetSede || opts.defaultLabel });
  }
  return { inputs, columnas, hojas, hojas_omitidas };
}