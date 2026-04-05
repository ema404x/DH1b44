// ─────────────────────────────────────────────────────────────────────────────
// MEJORES — Quote (Presupuesto simple) PDF & Excel export
// ─────────────────────────────────────────────────────────────────────────────
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const fmt = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (d) => {
  try { return d ? format(new Date(d), 'dd/MM/yyyy', { locale: es }) : '—'; } catch { return d || '—'; }
};

// Paleta Mejores: gris oscuro + rojo + blanco
const C = {
  dark:   [60, 60, 60],
  red:    [192, 57, 43],
  white:  [255, 255, 255],
  offWht: [250, 250, 250],
  gray1:  [50, 50, 50],
  gray2:  [100, 100, 100],
  gray3:  [160, 160, 160],
  gray4:  [220, 220, 220],
  rowAlt: [247, 247, 247],
  // aliases
  get navy() { return this.dark; },
  get blue() { return this.red; },
  get accent() { return [90,90,90]; },
  get gold() { return this.red; },
};

// ── PDF ───────────────────────────────────────────────────────────────────────
export function exportQuotePDF(quote) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, M = 14, COL = W - M * 2;
  let y = 0;

  // ── Header: fondo blanco con línea roja inferior
  doc.setFillColor(...C.white); doc.rect(0, 0, W, 52, 'F');
  doc.setFillColor(...C.red); doc.rect(0, 49, W, 3, 'F');

  // ── Logo vectorial Mejores
  const lx = M, ly = 8;
  doc.setFillColor(90,90,90); doc.rect(lx, ly, 5, 10, 'F');          // gris grande izq
  doc.setFillColor(...C.red);  doc.rect(lx+6, ly, 9, 4.5, 'F');      // rojo arriba der
  doc.setFillColor(90,90,90);  doc.rect(lx+6, ly+5.5, 9, 4.5, 'F'); // gris abajo der
  doc.setFillColor(...C.red);  doc.circle(lx+24, ly+1, 1, 'F');      // punto rojo

  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...C.dark);
  doc.text('Mejores', lx + 17, ly + 9);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...C.gray3);
  doc.text('en mantenimiento, obras y servicios', lx + 17, ly + 13.5);
  doc.setFontSize(6.5);
  doc.text('info@mejores.com.ar  ·  +54 (11) 4000-0000', lx + 17, ly + 17.5);

  // Divisor vertical
  doc.setDrawColor(...C.gray4); doc.setLineWidth(0.3);
  doc.line(W/2, 6, W/2, 46);

  // Right info
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...C.dark);
  doc.text('PRESUPUESTO', W - M, 16, { align: 'right' });

  const estadoColor = { borrador: C.gray3, enviado: [90,90,90], aprobado: [60,140,60], rechazado: C.red, vencido: [140,100,0] };
  const stColor = estadoColor[quote.status] || C.gray3;
  doc.setFillColor(...stColor);
  doc.roundedRect(W - M - 30, 21, 30, 6.5, 1, 1, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...C.white);
  doc.text((quote.status || '').toUpperCase(), W - M - 15, 25.5, { align: 'center' });

  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.gray2);
  doc.text(`Código: ${quote.code || '—'}`, W - M, 32, { align: 'right' });
  doc.text(`Emisión: ${fmtDate(new Date())}`, W - M, 37, { align: 'right' });
  doc.text(`Válido hasta: ${fmtDate(quote.valid_until)}`, W - M, 42, { align: 'right' });

  y = 58;

  // ── Client info
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...C.red);
  doc.text('DATOS DEL PRESUPUESTO', M, y);
  doc.setDrawColor(...C.red); doc.setLineWidth(0.5);
  doc.line(M, y + 1.5, M + 60, y + 1.5);
  y += 5;

  const infoItems = [
    ['Cliente', quote.client_name || '—'],
    ['Título', quote.title || '—'],
    ['Descripción', quote.description || '—'],
  ];
  infoItems.forEach(([label, val]) => {
    doc.setFillColor(...C.offWht); doc.roundedRect(M, y - 1, COL, 7, 0.8, 0.8, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...C.gray2);
    doc.text(label, M + 2, y + 2);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.gray1);
    doc.text(doc.splitTextToSize(val, COL - 30)[0], M + 28, y + 5.5);
    y += 9;
  });
  y += 4;

  // ── Items table header
  doc.setFillColor(...C.dark); doc.rect(M, y, COL, 6.5, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...C.white);
  doc.text('DESCRIPCIÓN', M + 2, y + 4.2);
  doc.text('CANT.', M + 118, y + 4.2, { align: 'right' });
  doc.text('P. UNIT.', M + 152, y + 4.2, { align: 'right' });
  doc.text('TOTAL', W - M - 1, y + 4.2, { align: 'right' });
  y += 7.5;

  // Items
  (quote.items || []).forEach((item, idx) => {
    if (y + 7 > 275) {
      doc.addPage(); y = 14;
      doc.setFillColor(...C.navy); doc.rect(0, 0, W, 6, 'F');
      doc.setFillColor(...C.blue); doc.rect(0, 6, W, 1, 'F');
      y = 14;
    }
    if (idx % 2 === 1) { doc.setFillColor(...C.rowAlt); doc.rect(M, y, COL, 6, 'F'); }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...C.gray1);
    doc.text(doc.splitTextToSize(item.description || '', 100)[0], M + 2, y + 4);
    doc.text(String(item.quantity ?? ''), M + 118, y + 4, { align: 'right' });
    doc.setTextColor(...C.gray2);
    doc.text(fmt(item.unit_price), M + 152, y + 4, { align: 'right' });
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.gray1);
    doc.text(fmt(item.total), W - M - 1, y + 4, { align: 'right' });
    y += 6;
  });

  if (!quote.items || quote.items.length === 0) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.gray3);
    doc.text('Sin ítems registrados.', M + 2, y + 5);
    y += 12;
  }

  // ── Financial summary
  y += 4;
  doc.setDrawColor(...C.gray4); doc.setLineWidth(0.4);
  doc.line(M, y, W - M, y);
  y += 6;

  const subtotal = (quote.items || []).reduce((s, i) => s + (i.total || 0), 0);
  const taxRate = quote.tax_rate || 21;
  const iva = subtotal * (taxRate / 100);
  const total = subtotal + iva;

  const bx = M + 80, bw = COL - 80;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...C.dark);
  doc.text('RESUMEN', bx, y);
  y += 5;

  [[`Subtotal`, subtotal], [`IVA (${taxRate}%)`, iva]].forEach(([label, val], i) => {
    doc.setFillColor(...(i % 2 === 0 ? C.offWht : C.white));
    doc.rect(bx, y - 1, bw, 5.5, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.gray2);
    doc.text(label, bx + 2, y + 3);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.gray1);
    doc.text(fmt(val), W - M - 1, y + 3, { align: 'right' });
    y += 5.5;
  });

  y += 2;
  doc.setFillColor(...C.dark); doc.rect(bx, y, bw, 11, 'F');
  doc.setFillColor(...C.red); doc.rect(bx, y, 3, 11, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...C.white);
  doc.text('TOTAL', bx + 6, y + 7);
  doc.setFontSize(11); doc.setTextColor(...C.white);
  doc.text(fmt(total), W - M - 1, y + 7, { align: 'right' });
  y += 16;

  // Notes
  if (quote.notes) {
    if (y + 20 > 275) { doc.addPage(); y = 14; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...C.red);
    doc.text('NOTAS Y CONDICIONES', M, y);
    y += 4;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.gray2);
    const lines = doc.splitTextToSize(quote.notes, COL - 4);
    doc.setFillColor(...C.offWht); doc.rect(M, y - 1, COL, lines.length * 4 + 3, 'F');
    doc.text(lines, M + 2, y + 3);
  }

  // Footer
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFillColor(...C.red); doc.rect(0, 287, W, 10, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...C.white);
    doc.text('MEJORES — en mantenimiento, obras y servicios  ·  info@mejores.com.ar', M, 293);
    doc.text(`${quote.code || 'PRESUPUESTO'}  ·  Pág. ${i} / ${pages}`, W - M, 293, { align: 'right' });
    if (i > 1) { doc.setFillColor(...C.red); doc.rect(0, 0, W, 3, 'F'); }
  }

  doc.save(`${quote.code || 'presupuesto'}_MEJORES.pdf`);
}

// ── Excel ─────────────────────────────────────────────────────────────────────
// Re-uses the same native ZIP approach from exportExcel.js
function escXml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function colName(idx) {
  let name = ''; idx++;
  while (idx > 0) { name = String.fromCharCode(64 + (idx % 26 || 26)) + name; idx = Math.floor((idx - 1) / 26); }
  return name;
}
function str2bytes(str) { return new TextEncoder().encode(str); }
function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  const table = [];
  for (let i = 0; i < 256; i++) { let c = i; for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); table[i] = c; }
  for (const byte of bytes) crc = table[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function buildZip(files) {
  let offset = 0;
  const local = [], central = [];
  for (const [name, content] of Object.entries(files)) {
    const nb = str2bytes(name), db = str2bytes(content), crc = crc32(db), sz = db.length;
    const lh = new Uint8Array(30 + nb.length); const lv = new DataView(lh.buffer);
    lv.setUint32(0,0x04034b50,true); lv.setUint16(4,20,true); lv.setUint16(6,0,true); lv.setUint16(8,0,true);
    lv.setUint16(10,0,true); lv.setUint16(12,0,true); lv.setUint32(14,crc,true); lv.setUint32(18,sz,true);
    lv.setUint32(22,sz,true); lv.setUint16(26,nb.length,true); lv.setUint16(28,0,true); lh.set(nb,30);
    const ch = new Uint8Array(46 + nb.length); const cv = new DataView(ch.buffer);
    cv.setUint32(0,0x02014b50,true); cv.setUint16(4,20,true); cv.setUint16(6,20,true);
    [8,10,12,14].forEach(o=>cv.setUint16(o,0,true)); cv.setUint32(16,crc,true); cv.setUint32(20,sz,true);
    cv.setUint32(24,sz,true); cv.setUint16(28,nb.length,true); [30,32,34,36].forEach(o=>cv.setUint16(o,0,true));
    cv.setUint32(38,0,true); cv.setUint32(42,offset,true); ch.set(nb,46);
    local.push(lh,db); central.push(ch); offset += lh.length + db.length;
  }
  const cdSz = central.reduce((s,c)=>s+c.length,0);
  const eocd = new Uint8Array(22); const ev = new DataView(eocd.buffer);
  ev.setUint32(0,0x06054b50,true); ev.setUint16(4,0,true); ev.setUint16(6,0,true);
  ev.setUint16(8,central.length,true); ev.setUint16(10,central.length,true);
  ev.setUint32(12,cdSz,true); ev.setUint32(16,offset,true); ev.setUint16(20,0,true);
  const parts=[...local,...central,eocd]; const tot=parts.reduce((s,p)=>s+p.length,0);
  const res=new Uint8Array(tot); let pos=0; for(const p of parts){res.set(p,pos);pos+=p.length;} return res;
}

export function exportQuoteExcel(quote) {
  const subtotal = (quote.items || []).reduce((s, i) => s + (i.total || 0), 0);
  const taxRate = quote.tax_rate || 21;
  const iva = subtotal * (taxRate / 100);
  const total = subtotal + iva;

  const ss = []; const ssMap = {};
  const idx = (v) => { const s = String(v ?? ''); if (ssMap[s] === undefined) { ssMap[s] = ss.length; ss.push(s); } return ssMap[s]; };

  const rows = [
    // Header
    `<row r="1" ht="26" customHeight="1">
      <c r="A1" t="s"><v>${idx('MEJORES — PRESUPUESTO')}</v></c>
      <c r="B1" t="s"><v>${idx('')}</v></c>
      <c r="C1" t="s"><v>${idx('')}</v></c>
      <c r="D1" t="s"><v>${idx('')}</v></c>
    </row>`,
    `<row r="2" ht="13" customHeight="1">
      <c r="A2" t="s"><v>${idx('Mantenimiento y Construcción Escolar  ·  info@mejores.com.ar')}</v></c>
    </row>`,
    `<row r="3"><c r="A3" t="s"><v>${idx('')}</v></c></row>`,
    `<row r="4">
      <c r="A4" t="s"><v>${idx('Código:')}</v></c><c r="B4" t="s"><v>${idx(quote.code || '—')}</v></c>
      <c r="C4" t="s"><v>${idx('Estado:')}</v></c><c r="D4" t="s"><v>${idx((quote.status||'').toUpperCase())}</v></c>
    </row>`,
    `<row r="5">
      <c r="A5" t="s"><v>${idx('Cliente:')}</v></c><c r="B5" t="s"><v>${idx(quote.client_name||'—')}</v></c>
    </row>`,
    `<row r="6">
      <c r="A6" t="s"><v>${idx('Título:')}</v></c><c r="B6" t="s"><v>${idx(quote.title||'—')}</v></c>
    </row>`,
    `<row r="7">
      <c r="A7" t="s"><v>${idx('Válido hasta:')}</v></c><c r="B7" t="s"><v>${idx(fmtDate(quote.valid_until))}</v></c>
      <c r="C7" t="s"><v>${idx('Emisión:')}</v></c><c r="D7" t="s"><v>${idx(fmtDate(new Date()))}</v></c>
    </row>`,
    `<row r="8"><c r="A8" t="s"><v>${idx('')}</v></c></row>`,
    // Table header
    `<row r="9" ht="15" customHeight="1">
      <c r="A9" t="s"><v>${idx('DESCRIPCIÓN')}</v></c>
      <c r="B9" t="s"><v>${idx('CANTIDAD')}</v></c>
      <c r="C9" t="s"><v>${idx('PRECIO UNIT.')}</v></c>
      <c r="D9" t="s"><v>${idx('TOTAL')}</v></c>
    </row>`,
  ];

  (quote.items || []).forEach((item, i) => {
    const r = i + 10;
    rows.push(`<row r="${r}">
      <c r="A${r}" t="s"><v>${idx(item.description || '')}</v></c>
      <c r="B${r}" t="n"><v>${item.quantity || 0}</v></c>
      <c r="C${r}" t="n"><v>${item.unit_price || 0}</v></c>
      <c r="D${r}" t="n"><v>${item.total || 0}</v></c>
    </row>`);
  });

  const br = (quote.items || []).length + 11;
  rows.push(`<row r="${br}"><c r="A${br}" t="s"><v>${idx('')}</v></c></row>`);
  rows.push(`<row r="${br+1}"><c r="C${br+1}" t="s"><v>${idx('Subtotal')}</v></c><c r="D${br+1}" t="n"><v>${subtotal}</v></c></row>`);
  rows.push(`<row r="${br+2}"><c r="C${br+2}" t="s"><v>${idx(`IVA (${taxRate}%)`)}</v></c><c r="D${br+2}" t="n"><v>${iva}</v></c></row>`);
  rows.push(`<row r="${br+3}"><c r="C${br+3}" t="s"><v>${idx('TOTAL')}</v></c><c r="D${br+3}" t="n"><v>${total}</v></c></row>`);
  if (quote.notes) {
    rows.push(`<row r="${br+5}"><c r="A${br+5}" t="s"><v>${idx('NOTAS:')}</v></c><c r="B${br+5}" t="s"><v>${idx(quote.notes)}</v></c></row>`);
  }

  const ssXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${ss.length}" uniqueCount="${ss.length}">
${ss.map(v=>`<si><t xml:space="preserve">${escXml(v)}</t></si>`).join('')}
</sst>`;

  const colsXml = `<cols>
    <col min="1" max="1" width="45" customWidth="1"/>
    <col min="2" max="2" width="12" customWidth="1"/>
    <col min="3" max="3" width="18" customWidth="1"/>
    <col min="4" max="4" width="18" customWidth="1"/>
  </cols>`;

  const mergesXml = `<mergeCells count="3"><mergeCell ref="A1:D1"/><mergeCell ref="A2:D2"/><mergeCell ref="B5:D5"/></mergeCells>`;

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
${colsXml}
<sheetData>${rows.join('')}</sheetData>
${mergesXml}
</worksheet>`;

  const wbXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Presupuesto" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`;

  const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const zip = buildZip({
    '[Content_Types].xml': ct,
    '_rels/.rels': rootRels,
    'xl/workbook.xml': wbXml,
    'xl/_rels/workbook.xml.rels': wbRels,
    'xl/sharedStrings.xml': ssXml,
    'xl/worksheets/sheet1.xml': sheetXml,
  });

  const blob = new Blob([zip], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${quote.code || 'presupuesto'}_MEJORES.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}