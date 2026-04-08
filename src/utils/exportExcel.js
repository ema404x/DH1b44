// ─────────────────────────────────────────────────────────────────────────────
// MEJORES — Excel export en formato PCP Ministerio de Educación GCBA
// Genera la "Planilla de Cómputo y Presupuesto" (PCP) directamente desde el
// form del PresupuestoObra (rubros con items del preciario)
// ─────────────────────────────────────────────────────────────────────────────

// ── ZIP builder ───────────────────────────────────────────────────────────────
function str2bytes(str) { return new TextEncoder().encode(str); }

function crc32(bytes) {
  const table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c;
  }
  let crc = 0xFFFFFFFF;
  for (const b of bytes) crc = table[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function buildZip(files) {
  let offset = 0;
  const localParts = [], centralHeaders = [];
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = str2bytes(name);
    const dataBytes = typeof content === 'string' ? str2bytes(content) : content;
    const crc = crc32(dataBytes), size = dataBytes.length;
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
  for (const p of parts) { result.set(p, pos); pos += p.length; }
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

// ── Styles PCP Ministerio ─────────────────────────────────────────────────────
// Fuente Arial, paleta azul marino / gris como el formato oficial
const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="8">
    <font><sz val="9"/><name val="Arial"/></font>
    <font><b/><sz val="9"/><name val="Arial"/></font>
    <font><b/><sz val="9"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
    <font><b/><sz val="9"/><color rgb="FF0A1834"/><name val="Arial"/></font>
    <font><sz val="8"/><color rgb="FF505050"/><name val="Arial"/></font>
    <font><b/><sz val="14"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
    <font><b/><sz val="9"/><color rgb="FF1A3C6E"/><name val="Arial"/></font>
  </fonts>
  <fills count="11">
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
    <fill><patternFill patternType="solid"><fgColor rgb="FFDCE6F1"/></patternFill></fill>
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
  <cellXfs count="20">
    <xf numFmtId="0"  fontId="0" fillId="0"  borderId="0" xfId="0"/>
    <xf numFmtId="0"  fontId="1" fillId="0"  borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0"  fontId="2" fillId="2"  borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0"  fontId="3" fillId="2"  borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0"  fontId="6" fillId="2"  borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0"  fontId="2" fillId="3"  borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0"  fontId="4" fillId="4"  borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0"  fontId="7" fillId="4"  borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0"  fontId="0" fillId="5"  borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="4"  fontId="0" fillId="5"  borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="4"  fontId="1" fillId="6"  borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="4"  fontId="1" fillId="7"  borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="4"  fontId="2" fillId="2"  borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0"  fontId="0" fillId="5"  borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="2"  fontId="0" fillId="5"  borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="4"  fontId="1" fillId="9"  borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0"  fontId="5" fillId="0"  borderId="0" xfId="0" applyFont="1"><alignment horizontal="left"/></xf>
    <xf numFmtId="0"  fontId="1" fillId="0"  borderId="2" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="left"/></xf>
    <xf numFmtId="4"  fontId="4" fillId="8"  borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0"  fontId="1" fillId="10" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="left" vertical="center"/></xf>
  </cellXfs>
</styleSheet>`;

const S = {
  normal:       0,
  bold:         1,
  hdrNavy:      2,    // white bold on navy, centered wrap
  hdrNavyC:     3,    // white bold on navy, centered
  hdrNavyLg:    4,    // white bold large on navy, centered
  hdrBlue:      5,    // white bold on dark blue, centered wrap
  rubroFill:    6,    // navy text on light blue
  rubroSub:     7,    // blue text on light blue
  rowNormal:    8,    // normal on off-white
  rowNum:       9,    // number right on off-white
  rowNumYellow: 10,   // bold number on yellow (precio resultante)
  rowNumGreen:  11,   // bold number on green (subtotal rubro)
  totalNavy:    12,   // bold white on navy right
  rowCenter:    13,   // centered on off-white
  rowPct:       14,   // pct on off-white
  rowNumBlue:   15,   // bold number on blue
  italic:       16,
  sectionHdr:   17,   // bold with bottom border
  rowNumOrange: 18,   // number on orange (deflación)
  rubroHdrAlt:  19,   // bold on alternate blue
};

// ── Shared strings & sheet builder ────────────────────────────────────────────
function buildSST(strings) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">
${strings.map(s => `<si><t xml:space="preserve">${escXml(s)}</t></si>`).join('\n')}
</sst>`;
}

function buildSheet(rows, colWidths, merges) {
  const ss = [], ssMap = {};
  function idx(val) {
    const key = String(val ?? '');
    if (ssMap[key] === undefined) { ssMap[key] = ss.length; ss.push(key); }
    return ssMap[key];
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
  const mergesXml = merges?.length ? `<mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : '';
  return {
    xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
${colsXml}<sheetData>${rowsXml}</sheetData>${mergesXml}
</worksheet>`,
    ss
  };
}

// Cell helpers
const t = (v, s) => ({ v: String(v ?? ''), s });
const num = (v, s) => ({ v: Number(v) || 0, s });
const e = (s) => ({ v: '', s: s ?? 0 });

function addMerge(merges, r1, c1, r2, c2) {
  merges.push(`${colName(c1)}${r1}:${colName(c2)}${r2}`);
}

function fmtDate(d) {
  if (!d) return '';
  try {
    const dt = new Date(d + 'T00:00:00');
    return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
  } catch { return d; }
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────
export async function exportPresupuestoExcel(form) {
  const rubros = form.rubros || [];
  const coef_pase = form.coef_pase ?? 1.6504;
  const coef_oferta = form.coef_oferta ?? 1.38;

  // Calcular totales financieros
  const subtotalObra = rubros.reduce((acc, r) =>
    acc + (r.items || []).reduce((a, i) => a + (Number(i.total) || 0), 0), 0);
  const gg = subtotalObra * ((form.gastos_generales_pct || 0) / 100);
  const ben = (subtotalObra + gg) * ((form.beneficio_pct || 0) / 100);
  const baseImponible = subtotalObra + gg + ben;
  const iva = baseImponible * ((form.iva_pct || 0) / 100);
  const total = baseImponible + iva;

  // ── Columnas: A=ITEM, B=CÓD.PRECIARIO, C=DESCRIPCIÓN, D=UNID, E=CANT,
  //             F=PU MAT, G=PU MO, H=TOTAL PU, I=COEF PASE, J=TOTAL PASE,
  //             K=COEF OFERTA, L=PRECIO RESULTANTE
  const colWidths = [7, 13, 52, 7, 9, 15, 15, 15, 9, 15, 9, 16];
  const NCOLS = 12;
  const merges = [];
  const rows = [];
  let R = 1;

  // ── Fila 1: Título principal ──────────────────────────────────────────────
  rows.push(Object.assign([
    t('PLANILLA DE CÓMPUTO Y PRESUPUESTO', S.hdrNavyLg),
    ...Array(NCOLS - 1).fill(e(S.hdrNavyLg))
  ], { _h: 28 }));
  addMerge(merges, R, 0, R, NCOLS - 1); R++;

  // ── Bloque de metadatos ───────────────────────────────────────────────────
  const metaBlock = [
    ['COMITENTE',    form.cliente_nombre  || 'GCBA - MINISTERIO DE EDUCACIÓN DE LA CIUDAD DE BUENOS AIRES'],
    ['LICITACIÓN',   form.licitacion      || ''],
    ['ESCUELA',      form.proyecto_nombre || ''],
    ['OBRA / TÍTULO', form.titulo         || ''],
    ['DIRECCIÓN',    form.direccion_obra  || ''],
    ['EMPRESA',      'MEJORES HOSPITALES S.A.'],
    ['SUPERVISOR',   form.responsable     || ''],
  ];

  for (const [label, value] of metaBlock) {
    rows.push(Object.assign([
      t(label, S.bold), e(S.bold),
      t(value, S.normal), ...Array(NCOLS - 3).fill(e(S.normal))
    ], { _h: 15 }));
    addMerge(merges, R, 0, R, 1);
    addMerge(merges, R, 2, R, NCOLS - 1);
    R++;
  }

  // Código, fecha, plazo, coeficientes en fila compacta
  rows.push(Object.assign([
    t('Nº PRESUPUESTO', S.bold), t(form.codigo || '', S.normal),
    t('FECHA', S.bold), t(fmtDate(form.fecha_emision), S.normal),
    t('PLAZO', S.bold), t(form.plazo || '', S.normal),
    t('Coef. Pase', S.bold), num(coef_pase, S.rowNum),
    t('Coef. Oferta', S.bold), num(coef_oferta, S.rowNum),
    e(), e()
  ], { _h: 15 }));
  R++;

  // Fecha preciario
  if (form.preciario_fecha) {
    rows.push(Object.assign([
      t('Preciario Utilizado', S.bold), e(S.bold),
      t(fmtDate(form.preciario_fecha), S.normal), ...Array(NCOLS - 3).fill(e())
    ], { _h: 13 }));
    addMerge(merges, R, 0, R, 1);
    addMerge(merges, R, 2, R, NCOLS - 1);
    R++;
  }

  // Separador
  rows.push(Object.assign(Array(NCOLS).fill(e()), { _h: 6 })); R++;

  // ── Cabecera de columnas ──────────────────────────────────────────────────
  rows.push(Object.assign([
    t('ÍTEM', S.hdrNavy),
    t('CÓD.\nPRECIARIO', S.hdrNavy),
    t('DESCRIPCIÓN', S.hdrNavy),
    t('UNID.', S.hdrNavy),
    t('CANT.', S.hdrNavy),
    t('PRECIOS UNITARIOS', S.hdrNavy), e(S.hdrNavy), e(S.hdrNavy),
    t('COEF.\nPASE', S.hdrNavy), e(S.hdrNavy),
    t('COEF.\nOFERTA', S.hdrNavy), e(S.hdrNavy),
  ], { _h: 35 }));
  addMerge(merges, R, 5, R, 7);  // PRECIOS UNITARIOS
  addMerge(merges, R, 8, R, 9);  // COEF PASE
  addMerge(merges, R, 10, R, 11); // COEF OFERTA
  R++;

  rows.push(Object.assign([
    e(S.hdrBlue), e(S.hdrBlue), e(S.hdrBlue),
    e(S.hdrBlue), e(S.hdrBlue),
    t('P.U.MAT.', S.hdrBlue), t('P.U.M.O.', S.hdrBlue), t('TOTAL', S.hdrBlue),
    t('COEFICIENTE', S.hdrBlue), t('TOTAL\nPASE', S.hdrBlue),
    t('COEFICIENTE', S.hdrBlue), t('PRECIO\nRESULTANTE', S.hdrBlue),
  ], { _h: 35 }));
  R++;

  // ── Ítems por rubro ───────────────────────────────────────────────────────
  let itemNum = 1;

  for (const rubro of rubros) {
    const rubroSubtotal = (rubro.items || []).reduce((a, i) => a + (Number(i.total) || 0), 0);

    // Encabezado rubro
    rows.push(Object.assign([
      t(`RUBRO: ${(rubro.nombre || '').toUpperCase()}`, S.rubroFill),
      ...Array(NCOLS - 2).fill(e(S.rubroFill)),
      num(rubroSubtotal, S.rowNumGreen),
    ], { _h: 16 }));
    addMerge(merges, R, 0, R, NCOLS - 2); R++;

    rows.push(Object.assign(Array(NCOLS).fill(e()), { _h: 4 })); R++;

    for (const item of (rubro.items || [])) {
      // Inferir PU MAT y PU MO si están guardados, si no, usar precio_unitario como PU MAT
      const pu_mat = Number(item.pu_mat) || Number(item.precio_unitario) || 0;
      const pu_mo  = Number(item.pu_mo) || 0;
      const total_pu = pu_mat + pu_mo;
      const total_pase   = total_pu > 0 ? total_pu * coef_pase : Number(item.precio_unitario) || 0;
      const precio_result = total_pase > 0 ? total_pase * coef_oferta : Number(item.precio_unitario) || 0;

      rows.push(Object.assign([
        t(String(itemNum++), S.rowCenter),
        t(item.codigo || '', S.rowNormal),
        t(item.descripcion || '', S.rowNormal),
        t(item.unidad || '', S.rowCenter),
        num(item.cantidad, S.rowNum),
        num(pu_mat,        S.rowNum),
        num(pu_mo,         S.rowNum),
        num(total_pu,      S.rowNum),
        num(coef_pase,     S.rowNormal),
        num(total_pase,    S.rowNum),
        num(coef_oferta,   S.rowNormal),
        num(precio_result, S.rowNumYellow),
      ], { _h: 14 }));
      R++;
    }

    // Subtotal rubro
    rows.push(Object.assign([
      ...Array(NCOLS - 2).fill(e(S.sectionHdr)),
      t(`Subtotal ${rubro.nombre || ''}`, S.bold),
      num(rubroSubtotal, S.rowNumGreen),
    ], { _h: 14 }));
    addMerge(merges, R, 0, R, NCOLS - 3); R++;

    rows.push(Object.assign(Array(NCOLS).fill(e()), { _h: 6 })); R++;
  }

  // ── Resumen financiero ────────────────────────────────────────────────────
  rows.push(Object.assign(Array(NCOLS).fill(e()), { _h: 6 })); R++;

  const summaryItems = [
    [`Subtotal de obra`, subtotalObra],
    [`Gastos generales (${form.gastos_generales_pct || 0}%)`, gg],
    [`Beneficio / utilidad (${form.beneficio_pct || 0}%)`, ben],
    [`Base imponible`, baseImponible],
    [`IVA (${form.iva_pct || 0}%)`, iva],
  ];

  for (const [label, val] of summaryItems) {
    rows.push(Object.assign([
      ...Array(NCOLS - 2).fill(e()),
      t(label, S.bold),
      num(val, S.rowNum),
    ], { _h: 13 }));
    addMerge(merges, R, 0, R, NCOLS - 3); R++;
  }

  rows.push(Object.assign(Array(NCOLS).fill(e()), { _h: 6 })); R++;

  // TOTAL PRESUPUESTO
  rows.push(Object.assign([
    t('TOTAL PRESUPUESTO', S.hdrNavyLg),
    ...Array(NCOLS - 2).fill(e(S.hdrNavyLg)),
    e(S.hdrNavyLg),
    num(total, S.totalNavy),
  ], { _h: 24 }));
  addMerge(merges, R, 0, R, NCOLS - 2); R++;

  // Notas
  if (form.notas) {
    rows.push(Object.assign(Array(NCOLS).fill(e()), { _h: 8 })); R++;
    rows.push(Object.assign([
      t('NOTAS:', S.bold),
      t(form.notas, S.italic),
      ...Array(NCOLS - 2).fill(e())
    ], { _h: 16 }));
    addMerge(merges, R, 1, R, NCOLS - 1); R++;
  }

  // ── Generar archivo ───────────────────────────────────────────────────────
  const { xml: sheetXml, ss } = buildSheet(rows, colWidths, merges);
  const sstXml = buildSST(ss);

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Planilla PCP" sheetId="1" r:id="rId2"/></sheets>
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
  a.download = `PCP_${form.codigo || 'presupuesto'}_MEJORES.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}