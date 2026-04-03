// Pure browser-based Excel export — no npm packages needed
// Generates a proper .xlsx using XML (SpreadsheetML), which Excel opens natively

const n = (v) => Number(v || 0);

function escXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildXlsx(sheets) {
  // sheets: [{ name, rows: [[cell,...], ...] }]
  // Each cell: string | number

  const sharedStrings = [];
  const ssMap = {};

  function getSSIndex(val) {
    const s = String(val);
    if (ssMap[s] === undefined) {
      ssMap[s] = sharedStrings.length;
      sharedStrings.push(s);
    }
    return ssMap[s];
  }

  const sheetsXml = sheets.map((sheet, sheetIdx) => {
    const rowsXml = sheet.rows.map((row, ri) => {
      const cellsXml = row.map((cell, ci) => {
        const col = colName(ci);
        const ref = `${col}${ri + 1}`;
        if (typeof cell === 'number') {
          return `<c r="${ref}"><v>${cell}</v></c>`;
        } else {
          const idx = getSSIndex(cell ?? '');
          return `<c r="${ref}" t="s"><v>${idx}</v></c>`;
        }
      }).join('');
      return `<row r="${ri + 1}">${cellsXml}</row>`;
    }).join('');

    return {
      name: sheet.name,
      xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>${rowsXml}</sheetData>
</worksheet>`,
    };
  });

  const ssXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">
${sharedStrings.map(s => `<si><t xml:space="preserve">${escXml(s)}</t></si>`).join('')}
</sst>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
${sheetsXml.map((s, i) => `<sheet name="${escXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 2}"/>`).join('')}
</sheets>
</workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
${sheetsXml.map((_, i) => `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}
</Relationships>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
${sheetsXml.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  // Build zip-like structure using a simple blob
  // Since we can't use JSZip, we'll write a minimal ZIP manually
  const files = {
    '[Content_Types].xml': contentTypes,
    '_rels/.rels': rootRels,
    'xl/workbook.xml': workbookXml,
    'xl/_rels/workbook.xml.rels': workbookRels,
    'xl/sharedStrings.xml': ssXml,
  };
  sheetsXml.forEach((s, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = s.xml;
  });

  return buildZip(files);
}

// ── Minimal ZIP builder ──────────────────────────────────────────────────
function str2bytes(str) {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  const table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c;
  }
  for (const byte of bytes) crc = table[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function buildZip(files) {
  const entries = [];
  let offset = 0;
  const localHeaders = [];
  const centralHeaders = [];

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = str2bytes(name);
    const dataBytes = str2bytes(content);
    const crc = crc32(dataBytes);
    const size = dataBytes.length;

    // Local file header
    const lh = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true);   // signature
    lv.setUint16(4, 20, true);            // version needed
    lv.setUint16(6, 0, true);             // flags
    lv.setUint16(8, 0, true);             // compression (stored)
    lv.setUint16(10, 0, true);            // mod time
    lv.setUint16(12, 0, true);            // mod date
    lv.setUint32(14, crc, true);          // crc32
    lv.setUint32(18, size, true);         // compressed size
    lv.setUint32(22, size, true);         // uncompressed size
    lv.setUint16(26, nameBytes.length, true); // name length
    lv.setUint16(28, 0, true);            // extra length
    lh.set(nameBytes, 30);

    // Central dir header
    const ch = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    ch.set(nameBytes, 46);

    entries.push(lh, dataBytes);
    centralHeaders.push(ch);
    offset += lh.length + dataBytes.length;
  }

  const centralDirSize = centralHeaders.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, centralHeaders.length, true);
  ev.setUint16(10, centralHeaders.length, true);
  ev.setUint32(12, centralDirSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const parts = [...entries, ...centralHeaders, eocd];
  const totalLen = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalLen);
  let pos = 0;
  for (const part of parts) { result.set(part, pos); pos += part.length; }
  return result;
}

function colName(idx) {
  let name = '';
  idx++;
  while (idx > 0) {
    name = String.fromCharCode(64 + (idx % 26 || 26)) + name;
    idx = Math.floor((idx - 1) / 26);
  }
  return name;
}

// ── PUBLIC API ───────────────────────────────────────────────────────────
export function exportPresupuestoExcel(form) {
  const headerRow = ['ÍTEM', 'CÓDIGO', 'DESCRIPCIÓN', 'UNIDAD', 'CANTIDAD', 'PRECIO UNITARIO', 'TOTAL'];
  const portadaRows = [
    ['MEJORES - Sistema de Gestión', ''],
    ['PRESUPUESTO DE OBRA - FORMATO MINISTERIAL', ''],
    ['', ''],
    ['Código:', form.codigo || ''],
    ['Título:', form.titulo || ''],
    ['Cliente:', form.cliente_nombre || ''],
    ['Proyecto:', form.proyecto_nombre || ''],
    ['Dirección:', form.direccion_obra || ''],
    ['Responsable:', form.responsable || ''],
    ['Fecha Emisión:', form.fecha_emision || ''],
    ['Válido Hasta:', form.fecha_validez || ''],
    ['Estado:', (form.estado || '').toUpperCase()],
  ];

  const planillaRows = [headerRow];
  let itemNum = 1;

  (form.rubros || []).forEach((rubro) => {
    planillaRows.push([`── ${(rubro.nombre || 'RUBRO').toUpperCase()} ──`, '', '', '', '', '', '']);
    (rubro.items || []).forEach((item) => {
      planillaRows.push([
        itemNum++,
        item.codigo || '',
        item.descripcion || '',
        item.unidad || '',
        n(item.cantidad),
        n(item.precio_unitario),
        n(item.total),
      ]);
    });
    const rubroSub = (rubro.items || []).reduce((s, i) => s + n(i.total), 0);
    planillaRows.push(['', '', `Subtotal ${rubro.nombre || ''}`, '', '', '', rubroSub]);
    planillaRows.push(['', '', '', '', '', '', '']);
  });

  const subtotal = (form.rubros || []).reduce((acc, r) =>
    acc + (r.items || []).reduce((a, i) => a + n(i.total), 0), 0);
  const gg = subtotal * ((form.gastos_generales_pct || 15) / 100);
  const ben = (subtotal + gg) * ((form.beneficio_pct || 10) / 100);
  const baseImponible = subtotal + gg + ben;
  const iva = baseImponible * ((form.iva_pct || 21) / 100);
  const total = baseImponible + iva;

  planillaRows.push(
    ['', '', '', '', '', '', ''],
    ['', '', 'RESUMEN FINANCIERO', '', '', '', ''],
    ['', '', 'Subtotal de obra', '', '', '', subtotal],
    ['', '', `Gastos Generales (${form.gastos_generales_pct || 15}%)`, '', '', '', gg],
    ['', '', `Beneficio (${form.beneficio_pct || 10}%)`, '', '', '', ben],
    ['', '', 'Base Imponible', '', '', '', baseImponible],
    ['', '', `IVA (${form.iva_pct || 21}%)`, '', '', '', iva],
    ['', '', 'TOTAL', '', '', '', total],
  );

  const zipBytes = buildXlsx([
    { name: 'Portada', rows: portadaRows },
    { name: 'Planilla Ministerio', rows: planillaRows },
  ]);

  const blob = new Blob([zipBytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${form.codigo || 'presupuesto'}_ministerio.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}