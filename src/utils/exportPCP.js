// ─────────────────────────────────────────────────────────────────────────────
// MEJORES — Exportación Excel en formato PCP Ministerio de Educación GCBA
// Replica exactamente el formato de la Planilla de Cómputo y Presupuesto (PCP)
// ─────────────────────────────────────────────────────────────────────────────

// ── ZIP builder (same minimal implementation) ────────────────────────────────
function str2bytes(str) { return new TextEncoder().encode(str); }

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
  let offset = 0;
  const localParts = [];
  const centralHeaders = [];
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = str2bytes(name);
    const dataBytes = typeof content === 'string' ? str2bytes(content) : content;
    const crc = crc32(dataBytes);
    const size = dataBytes.length;
    const lh = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true);
    lv.setUint32(14, crc, true); lv.setUint32(18, size, true); lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true); lh.set(nameBytes, 30);
    const ch = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, size, true); cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true); cv.setUint32(42, offset, true); ch.set(nameBytes, 46);
    localParts.push(lh, dataBytes); centralHeaders.push(ch);
    offset += lh.length + dataBytes.length;
  }
  const cdSize = centralHeaders.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, centralHeaders.length, true); ev.setUint16(10, centralHeaders.length, true);
  ev.setUint32(12, cdSize, true); ev.setUint32(16, offset, true);
  const parts = [...localParts, ...centralHeaders, eocd];
  const total = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(total);
  let pos = 0;
  for (const part of parts) { result.set(part, pos); pos += part.length; }
  return result;
}

function escXml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function colName(idx) {
  let name = ''; idx++;
  while (idx > 0) { name = String.fromCharCode(64 + (idx % 26 || 26)) + name; idx = Math.floor((idx - 1) / 26); }
  return name;
}

// ── Styles optimized for PCP format ──────────────────────────────────────────
const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="7">
    <font><sz val="9"/><name val="Arial"/></font>
    <font><b/><sz val="9"/><name val="Arial"/></font>
    <font><b/><sz val="9"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
    <font><b/><sz val="11"/><name val="Arial"/></font>
    <font><sz val="8"/><color rgb="FF505050"/><name val="Arial"/></font>
    <font><b/><sz val="9"/><color rgb="FF0A1834"/><name val="Arial"/></font>
  </fonts>
  <fills count="10">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0A1834"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1D4060"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFCDD9E5"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEFF3F7"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFFFCC"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE2EFDA"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFCE4D6"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD9E1F2"/></patternFill></fill>
  </fills>
  <borders count="4">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFB0BEC5"/></left>
      <right style="thin"><color rgb="FFB0BEC5"/></right>
      <top style="thin"><color rgb="FFB0BEC5"/></top>
      <bottom style="thin"><color rgb="FFB0BEC5"/></bottom>
    </border>
    <border><left/><right/><top/><bottom style="medium"><color rgb="FF0A1834"/></bottom></border>
    <border>
      <left style="medium"><color rgb="FF0A1834"/></left>
      <right style="medium"><color rgb="FF0A1834"/></right>
      <top style="medium"><color rgb="FF0A1834"/></top>
      <bottom style="medium"><color rgb="FF0A1834"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="18">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="2" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="6" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="4" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="4" fontId="1" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="4" fontId="1" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="4" fontId="2" fillId="2" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="2" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="4" fontId="1" fillId="9" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment horizontal="left"/></xf>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="left"/></xf>
    <xf numFmtId="4" fontId="6" fillId="8" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
  </cellXfs>
</styleSheet>`;

// Style index constants
const S = {
  normal: 0,
  bold: 1,
  hdrNavy: 2,       // bold white on navy, centered, wrap
  hdrNavyLg: 3,     // bold white on navy large, centered
  hdrBlue: 4,       // bold white on dark blue, centered, wrap
  rubroFill: 5,     // bold on light blue bg
  rubroSub: 6,      // navy text on light blue
  rowNormal: 7,     // normal on off-white with border
  rowNum: 8,        // number right-aligned on off-white
  rowNumYellow: 9,  // bold number on yellow (totals)
  rowNumGreen: 10,  // bold number on green
  totalNavy: 11,    // bold white number on navy right
  rowCenter: 12,    // centered on off-white
  rowPct: 13,       // percentage on off-white
  rowNumBlue: 14,   // bold number on blue bg (TOTAL OFERTA)
  italic: 15,
  sectionHdr: 16,   // bold with bottom border
  rowNumOrange: 17, // orange bg for deflation
};

function buildSST(strings) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">
${strings.map(s => `<si><t xml:space="preserve">${escXml(s)}</t></si>`).join('\n')}
</sst>`;
}

function buildSheetXml(rows, colWidths, merges) {
  const ss = []; const ssMap = {};
  function idx(val) {
    const s = String(val ?? '');
    if (ssMap[s] === undefined) { ssMap[s] = ss.length; ss.push(s); }
    return ssMap[s];
  }
  const rowsXml = rows.map((row, ri) => {
    const hAttr = row._h ? ` ht="${row._h}" customHeight="1"` : '';
    const cells = (Array.isArray(row) ? row : []).map((cell, ci) => {
      if (cell === null || cell === undefined) return '';
      const ref = `${colName(ci)}${ri + 1}`;
      const st = cell.s !== undefined ? ` s="${cell.s}"` : '';
      if (typeof cell.v === 'number') return `<c r="${ref}" t="n"${st}><v>${cell.v}</v></c>`;
      return `<c r="${ref}" t="s"${st}><v>${idx(cell.v ?? '')}</v></c>`;
    }).join('');
    return `<row r="${ri + 1}"${hAttr}>${cells}</row>`;
  }).join('');
  const colsXml = colWidths ? `<cols>${colWidths.map((w, i) => `<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
  const mergesXml = (merges?.length) ? `<mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : '';
  return { xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
${colsXml}<sheetData>${rowsXml}</sheetData>${mergesXml}
</worksheet>`, ss };
}

function t(v, s) { return { v, s }; }
function n(v, s) { return { v: Number(v) || 0, s }; }
function e(s) { return { v: '', s: s ?? 0 }; }

// ── Main export function ──────────────────────────────────────────────────────
export async function exportPresupuestoPCP(form) {
  // form: { codigo, titulo, cliente_nombre, comitente, licitacion, numero_presupuesto,
  //   direccion, escuela, obra, supervisor, inspector, fecha, plazo,
  //   coef_pase (1.6504), coef_oferta (1.38),
  //   ubicaciones: [{ nombre, rubros: [{ nombre, items: [...] }] }],
  //   generales: [...items],
  //   notas }
  //
  // item: { item_presup, item_preciario, descripcion, unidad, cantidad,
  //   pu_mat, pu_mo, total, deflacion_precio, deflacion_coef, deflacion_deflacionado,
  //   total_pase, total_oferta }

  const coef_pase = form.coef_pase ?? 1.6504;
  const coef_oferta = form.coef_oferta ?? 1.38;
  const fecha = form.fecha || new Date().toLocaleDateString('es-AR');

  // ── Columns layout (21 cols matching PCP exactly) ─────────────────────────
  // A=ITEM PRESUP, B=ITEM PRECIARIO, C=DESCRIPCIÓN, D=UNID, E=CANT,
  // F=PU MAT, G=PU MO, H=TOTAL (F+G), I=DEFL PRECIO, J=DEFL COEF, K=DEFL DEFLACIONADO,
  // L=COEF PASE, M=TOTAL PASE, N=COEF OFERTA, O=PRECIO RESULTANTE (SUBTOTAL),
  // P=vacío, Q=AVANCE, R=% AVANCE, S=ANT, T=ACT, U=ACUM

  const colWidths = [8, 12, 50, 7, 8, 14, 14, 14, 14, 8, 14, 8, 14, 8, 14, 4, 10, 8, 10, 10, 10];
  const merges = [];
  const rows = [];

  function addMerge(r1, c1, r2, c2) {
    merges.push(`${colName(c1)}${r1}:${colName(c2)}${r2}`);
  }

  let R = 1; // 1-indexed row

  // ── Row 1: Main title ─────────────────────────────────────────────────────
  rows.push(Object.assign([
    t('PLANILLA DE CÓMPUTO Y PRESUPUESTO', S.hdrNavyLg),
    ...Array(20).fill(e(S.hdrNavyLg))
  ], { _h: 28 }));
  addMerge(R, 0, R, 20); R++;

  // ── Header info block ─────────────────────────────────────────────────────
  const metaRows = [
    ['COMITENTE', form.comitente || 'GCBA - MINISTERIO DE EDUCACIÓN DE LA CIUDAD DE BUENOS AIRES - DGMESC'],
    ['LICITACIÓN', form.licitacion || ''],
  ];
  for (const [label, value] of metaRows) {
    rows.push(Object.assign([
      t(label, S.bold), e(S.bold), e(S.bold),
      t(value, S.normal), ...Array(17).fill(e())
    ], { _h: 16 }));
    addMerge(R, 3, R, 20); R++;
  }

  // Row: ZONA + EMPRESA + Nº PRESUPUESTO
  rows.push(Object.assign([
    t(form.zona || form.codigo || '', S.bold), e(), e(),
    t(`EMPRESA: ${form.empresa || 'MEJORES HOSPITALES S.A.'}`, S.bold),
    ...Array(7).fill(e()),
    t('Nº PRESUPUESTO', S.bold), e(), e(), e(), e(), e(), e(), e(), e(), e()
  ], { _h: 16 }));
  addMerge(R, 3, R, 10); addMerge(R, 11, R, 14); R++;

  // Row: DIRECCIÓN + FECHA
  rows.push(Object.assign([
    e(), e(), e(),
    t(`DIRECCIÓN: ${form.direccion || ''}`, S.normal),
    ...Array(7).fill(e()),
    t('FECHA ingreso sap', S.bold), e(), e(), e(), e(), e(), e(), e(), e(), e()
  ], { _h: 16 }));
  addMerge(R, 3, R, 10); addMerge(R, 11, R, 20); R++;

  // Row: ESCUELA + PLAZO
  rows.push(Object.assign([
    e(), e(), e(),
    t(`ESCUELA: ${form.escuela || ''}`, S.normal),
    ...Array(7).fill(e()),
    t('PLAZO', S.bold), t(form.plazo || '', S.normal), e(), e(), e(), e(), e(), e(), e(), e()
  ], { _h: 16 }));
  addMerge(R, 3, R, 10); R++;

  // Row: OBRA + Preciario Utilizado
  rows.push(Object.assign([
    e(), e(), e(),
    t(`OBRA: ${form.obra || ''}`, S.normal),
    ...Array(7).fill(e()),
    t('Preciario Utilizado', S.bold), e(), e(), e(), e(), e(), e(), e(), e(), e()
  ], { _h: 16 }));
  addMerge(R, 3, R, 10); R++;

  // Row: Coef Pase
  rows.push(Object.assign([
    e(), e(), e(), e(), e(), e(), e(), e(), e(), e(), e(),
    t('Coef. Pase', S.bold), e(), n(coef_pase, S.normal), e(), e(), e(), e(), e(), e(), e()
  ], { _h: 14 }));
  R++;

  // Row: MTOM + SUPERVISOR + Coef Oferta
  rows.push(Object.assign([
    t(`MTOM Nº`, S.bold), e(), e(),
    t(`SUPERVISOR: ${form.supervisor || 'Arq. Claudio Muñoz'}`, S.bold),
    e(), e(), e(), e(),
    t(`INSPECTOR: ${form.inspector || ''}`, S.bold),
    e(), e(),
    t('Coef. Oferta', S.bold), e(), n(coef_oferta, S.normal), e(), e(), e(), e(), e(), e(), e()
  ], { _h: 16 }));
  addMerge(R, 3, R, 7); addMerge(R, 8, R, 10); R++;

  // Blank row
  rows.push(Object.assign(Array(21).fill(e()), { _h: 6 })); R++;

  // ── Column headers ────────────────────────────────────────────────────────
  rows.push(Object.assign([
    t('ITEM\nPRESUP', S.hdrNavy), t('ITEM\nPRECIARIO', S.hdrNavy), t('DESCRIPCIÓN', S.hdrNavy),
    t('CÓMPUTO', S.hdrNavy), e(S.hdrNavy),
    t('PRECIOS UNITARIOS', S.hdrNavy), e(S.hdrNavy), e(S.hdrNavy),
    t('DEFLACIÓN DE MATERIALES\nFUERA DE PRECIARIO', S.hdrNavy), e(S.hdrNavy), e(S.hdrNavy),
    t('COEF.\nPASE', S.hdrNavy), e(S.hdrNavy),
    t('COEF.\nOFERTA', S.hdrNavy), e(S.hdrNavy),
    t('SUBTOTAL', S.hdrNavy), e(S.hdrNavy),
    t('AVANCE', S.hdrNavy), t('%', S.hdrNavy), e(S.hdrNavy), e(S.hdrNavy)
  ], { _h: 40 }));
  addMerge(R, 3, R, 4); // CÓMPUTO
  addMerge(R, 5, R, 7); // PRECIOS UNITARIOS
  addMerge(R, 8, R, 10); // DEFLACIÓN
  addMerge(R, 11, R, 12); // COEF PASE
  addMerge(R, 13, R, 14); // COEF OFERTA
  addMerge(R, 15, R, 16); // SUBTOTAL
  R++;

  // Sub-headers
  rows.push(Object.assign([
    e(S.hdrBlue), e(S.hdrBlue), e(S.hdrBlue),
    t('UNID.', S.hdrBlue), t('CANT.', S.hdrBlue),
    t('P.U.MAT.', S.hdrBlue), t('P.U.M.O.', S.hdrBlue), t('TOTAL', S.hdrBlue),
    t('PRECIO\nACTUAL SIN IVA', S.hdrBlue), t('COEF.\nDEFLACTOR', S.hdrBlue), t('PRECIO\nDEFLACTIONADO', S.hdrBlue),
    t('COEFICIENTE', S.hdrBlue), t('TOTAL', S.hdrBlue),
    t('COEFICIENTE', S.hdrBlue), t('PRECIO\nRESULTANTE', S.hdrBlue),
    e(S.hdrBlue), e(S.hdrBlue),
    e(S.hdrBlue), t('ANTERIOR', S.hdrBlue), t('ACTUAL', S.hdrBlue), t('ACUMULADO', S.hdrBlue)
  ], { _h: 40 }));
  R++;

  // ── Items by Ubicación > Rubro ────────────────────────────────────────────
  let globalTotal = 0;

  const ubicaciones = form.ubicaciones || [];
  for (const ubicacion of ubicaciones) {
    // UBICACIÓN header
    rows.push(Object.assign([
      t(`UBICACIÓN - ZONA DE TRABAJO: ${ubicacion.nombre || ''}`, S.sectionHdr),
      ...Array(13).fill(e(S.sectionHdr)),
      t('TOTAL', S.bold), n(ubicacion.total || 0, S.rowNumBlue),
      ...Array(5).fill(e(S.sectionHdr))
    ], { _h: 18 }));
    addMerge(R, 0, R, 13); R++;

    rows.push(Object.assign(Array(21).fill(e()), { _h: 4 })); R++;

    for (const rubro of (ubicacion.rubros || [])) {
      // RUBRO header
      rows.push(Object.assign([
        t(`RUBRO: ${rubro.nombre || ''}`, S.rubroFill),
        ...Array(20).fill(e(S.rubroFill))
      ], { _h: 16 }));
      addMerge(R, 0, R, 20); R++;

      rows.push(Object.assign(Array(21).fill(e()), { _h: 4 })); R++;

      for (const item of (rubro.items || [])) {
        const total_pu = (item.pu_mat || 0) + (item.pu_mo || 0);
        const total_pase = item.total_pase ?? (total_pu * coef_pase);
        const total_oferta = item.total_oferta ?? (total_pase * coef_oferta);
        const subtotal = (item.cantidad || 1) * total_oferta;

        rows.push(Object.assign([
          t(item.item_presup || '', S.rowCenter),
          t(item.item_preciario || item.codigo || '', S.rowNormal),
          t(item.descripcion || '', S.rowNormal),
          t(item.unidad || '', S.rowCenter),
          n(item.cantidad, S.rowNum),
          n(item.pu_mat, S.rowNum),
          n(item.pu_mo, S.rowNum),
          n(total_pu, S.rowNum),
          n(item.deflacion_precio || 0, S.rowNumOrange),
          n(item.deflacion_coef || 6.37, S.rowNumOrange),
          n(item.deflacion_deflacionado || 0, S.rowNumOrange),
          n(coef_pase, S.rowNormal),
          n(total_pase, S.rowNum),
          n(coef_oferta, S.rowNormal),
          n(total_oferta, S.rowNumYellow),
          e(), e(),
          n(0, S.rowPct),
          n(0, S.rowPct), n(0, S.rowPct), n(0, S.rowPct)
        ], { _h: 14 }));
        R++;
        globalTotal += subtotal;
      }

      rows.push(Object.assign(Array(21).fill(e()), { _h: 4 })); R++;
    }
  }

  // ── GENERALES / VOLQUETES section ────────────────────────────────────────
  if (form.generales?.length > 0) {
    rows.push(Object.assign([
      t('GENERALES - VOLQUETES - ANDAMIOS - LIMPIEZA DE OBRA', S.sectionHdr),
      ...Array(13).fill(e(S.sectionHdr)),
      t('TOTAL', S.bold), n(form.total_generales || 0, S.rowNumBlue),
      ...Array(5).fill(e(S.sectionHdr))
    ], { _h: 18 }));
    addMerge(R, 0, R, 13); R++;

    rows.push(Object.assign(Array(21).fill(e()), { _h: 4 })); R++;

    for (const item of form.generales) {
      const total_pu = (item.pu_mat || 0) + (item.pu_mo || 0);
      const total_pase = item.total_pase ?? (total_pu * coef_pase);
      const total_oferta = item.total_oferta ?? (total_pase * coef_oferta);
      rows.push(Object.assign([
        t(item.item_presup || '', S.rowCenter),
        t(item.item_preciario || item.codigo || '', S.rowNormal),
        t(item.descripcion || '', S.rowNormal),
        t(item.unidad || '', S.rowCenter),
        n(item.cantidad, S.rowNum),
        n(item.pu_mat, S.rowNum),
        n(item.pu_mo, S.rowNum),
        n(total_pu, S.rowNum),
        n(item.deflacion_precio || 0, S.rowNumOrange),
        n(item.deflacion_coef || 6.37, S.rowNumOrange),
        n(item.deflacion_deflacionado || 0, S.rowNumOrange),
        n(coef_pase, S.rowNormal),
        n(total_pase, S.rowNum),
        n(coef_oferta, S.rowNormal),
        n(total_oferta, S.rowNumYellow),
        e(), e(),
        n(0, S.rowPct), n(0, S.rowPct), n(0, S.rowPct), n(0, S.rowPct)
      ], { _h: 14 }));
      R++;
    }
    rows.push(Object.assign(Array(21).fill(e()), { _h: 4 })); R++;
  }

  // ── TOTAL PRESUPUESTO ────────────────────────────────────────────────────
  rows.push(Object.assign(Array(21).fill(e()), { _h: 6 })); R++;
  rows.push(Object.assign([
    t('TOTAL PRESUPUESTO', S.hdrNavyLg),
    ...Array(13).fill(e(S.hdrNavyLg)),
    e(S.hdrNavyLg), n(form.total || globalTotal, S.totalNavy),
    ...Array(4).fill(e(S.hdrNavyLg))
  ], { _h: 24 }));
  addMerge(R, 0, R, 14); R++;

  // ── Notes ────────────────────────────────────────────────────────────────
  if (form.notas) {
    rows.push(Object.assign(Array(21).fill(e()), { _h: 8 })); R++;
    rows.push(Object.assign([
      t('NOTAS:', S.bold), t(form.notas, S.italic),
      ...Array(19).fill(e())
    ], { _h: 16 }));
    addMerge(R, 1, R, 20); R++;
  }

  // ── Build xlsx ──────────────────────────────────────────────────────────
  const { xml: sheetXml, ss } = buildSheetXml(rows, colWidths, merges);
  const sstXml = buildSST(ss);

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="PCP" sheetId="1" r:id="rId2"/></sheets>
</workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
<Relationship Id="rId1a" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const zipBytes = buildZip({
    '[Content_Types].xml': contentTypes,
    '_rels/.rels': rootRels,
    'xl/workbook.xml': workbookXml,
    'xl/_rels/workbook.xml.rels': workbookRels,
    'xl/sharedStrings.xml': sstXml,
    'xl/styles.xml': STYLES_XML,
    'xl/worksheets/sheet1.xml': sheetXml,
  });

  const blob = new Blob([zipBytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PCP_${form.codigo || form.titulo || 'presupuesto'}_MEJORES.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}