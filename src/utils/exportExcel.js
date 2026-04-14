// ─────────────────────────────────────────────────────────────────────────────
// MEJORES — Excel PCP exactamente igual al formato ministerial DH1
// 21 columnas: A=ITEM PRESUP, B=ITEM PRECIARIO, C=DESCRIPCIÓN, D=UNID, E=CANT,
//              F=P.U.MAT, G=P.U.M.O, H=TOTAL, I=DEFL PRECIO, J=DEFL COEF,
//              K=DEFL DEFLACIONADO, L=COEF PASE, M=TOTAL PASE, N=COEF OFERTA,
//              O=PRECIO RESULTANTE, P=vacío, Q=vacío, R=%, S=ANT, T=ACT, U=ACUM
// ─────────────────────────────────────────────────────────────────────────────

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
    const dataBytes = str2bytes(content);
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

// ── Estilos idénticos al original DH1 ────────────────────────────────────────
// Paleta: navy oscuro (#0A1834), azul medio (#1D4060), azul claro (#CDD9E5/#EFF3F7),
//         amarillo (#FFFF99), naranja claro (#FCE4D6), verde claro (#E2EFDA)
const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="8">
    <font><sz val="9"/><name val="Arial"/></font>
    <font><b/><sz val="9"/><name val="Arial"/></font>
    <font><b/><sz val="9"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
    <font><b/><sz val="9"/><color rgb="FF0A1834"/><name val="Arial"/></font>
    <font><sz val="8"/><color rgb="FF606060"/><name val="Arial"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
    <font><b/><sz val="9"/><color rgb="FF1D4060"/><name val="Arial"/></font>
  </fonts>
  <fills count="12">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0A1834"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1D4060"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFCDD9E5"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEFF3F7"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFFF99"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE2EFDA"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFCE4D6"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD9E1F2"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDCE6F1"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFBDD7EE"/></patternFill></fill>
  </fills>
  <borders count="5">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFB0BEC5"/></left>
      <right style="thin"><color rgb="FFB0BEC5"/></right>
      <top style="thin"><color rgb="FFB0BEC5"/></top>
      <bottom style="thin"><color rgb="FFB0BEC5"/></bottom>
    </border>
    <border>
      <left style="medium"><color rgb="FF0A1834"/></left>
      <right style="medium"><color rgb="FF0A1834"/></right>
      <top style="medium"><color rgb="FF0A1834"/></top>
      <bottom style="medium"><color rgb="FF0A1834"/></bottom>
    </border>
    <border><left/><right/><top/><bottom style="medium"><color rgb="FF0A1834"/></bottom></border>
    <border>
      <left style="thin"><color rgb="FF0A1834"/></left>
      <right style="thin"><color rgb="FF0A1834"/></right>
      <top style="thin"><color rgb="FF0A1834"/></top>
      <bottom style="thin"><color rgb="FF0A1834"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="22">
    <!-- 0: normal -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <!-- 1: bold -->
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <!-- 2: hdr navy grande - blanco centrado -->
    <xf numFmtId="0" fontId="6" fillId="2" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 3: hdr navy normal - blanco centrado wrap -->
    <xf numFmtId="0" fontId="2" fillId="2" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <!-- 4: hdr azul medio - blanco centrado wrap -->
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <!-- 5: rubro header - navy text sobre azul claro -->
    <xf numFmtId="0" fontId="4" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="left" vertical="center"/></xf>
    <!-- 6: ubicacion header - bold navy sobre azul muy claro -->
    <xf numFmtId="0" fontId="7" fillId="11" borderId="4" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="left" vertical="center"/></xf>
    <!-- 7: celda normal off-white con borde -->
    <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <!-- 8: número derecha off-white con borde -->
    <xf numFmtId="4" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <!-- 9: número amarillo bold (precio resultante) -->
    <xf numFmtId="4" fontId="1" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <!-- 10: número verde bold (subtotal rubro) -->
    <xf numFmtId="4" fontId="1" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <!-- 11: total navy - blanco bold derecha -->
    <xf numFmtId="4" fontId="3" fillId="2" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <!-- 12: centrado off-white con borde -->
    <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 13: número naranja (deflacion) -->
    <xf numFmtId="4" fontId="0" fillId="8" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <!-- 14: número azul claro (coef pase/oferta total) -->
    <xf numFmtId="4" fontId="1" fillId="9" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <!-- 15: italic gris (notas) -->
    <xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <!-- 16: bold con linea inferior (section header) -->
    <xf numFmtId="0" fontId="1" fillId="0" borderId="3" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="left"/></xf>
    <!-- 17: metadato label bold derecha -->
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment horizontal="right"/></xf>
    <!-- 18: porcentaje off-white -->
    <xf numFmtId="9" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <!-- 19: hdr navy texto izquierda bold blanco -->
    <xf numFmtId="0" fontId="2" fillId="2" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="left" vertical="center"/></xf>
    <!-- 20: número coef (normal off-white) -->
    <xf numFmtId="2" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <!-- 21: celda vacía off-white avance -->
    <xf numFmtId="4" fontId="0" fillId="10" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
  </cellXfs>
</styleSheet>`;

// Índices de estilo
const S = {
  normal:       0,
  bold:         1,
  hdrNavyLg:    2,   // título grande navy
  hdrNavy:      3,   // navy blanco centrado wrap
  hdrBlue:      4,   // azul oscuro blanco centrado wrap
  rubroFill:    5,   // navy text on light blue
  ubicFill:     6,   // ubicacion azul oscuro
  rowNormal:    7,   // celda texto off-white
  rowNum:       8,   // número off-white
  rowNumYellow: 9,   // precio resultante amarillo
  rowNumGreen:  10,  // subtotal verde
  totalNavy:    11,  // total navy blanco
  rowCenter:    12,  // centrado off-white
  rowNumOrange: 13,  // deflación naranja
  rowNumBlue:   14,  // total ubicación azul
  italic:       15,
  sectionHdr:   16,
  metaRight:    17,
  rowPct:       18,
  hdrNavyLeft:  19,
  rowCoef:      20,
  rowAvance:    21,
};

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

const t = (v, s) => ({ v: String(v ?? ''), s });
const num = (v, s) => ({ v: Number(v) || 0, s });
const e = (s) => ({ v: '', s: s ?? S.normal });

function addM(merges, r1, c1, r2, c2) {
  merges.push(`${colName(c1)}${r1}:${colName(c2)}${r2}`);
}

function fmtDate(d) {
  if (!d) return '';
  try {
    const parts = d.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return d;
  } catch { return d; }
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────
export async function exportPresupuestoExcel(form) {
  const rubros = form.rubros || [];
  const coef_pase   = Number(form.coef_pase)   || 1.6504;
  const coef_oferta = Number(form.coef_oferta) || 1.38;
  const DEFLCOEF    = 6.37; // coeficiente deflactor estándar

  // ── Anchos de columna exactos del formato PCP (21 cols A-U) ───────────────
  // A    B     C     D    E    F     G     H     I     J    K     L    M     N    O     P   Q   R   S   T   U
  const colWidths = [8,  14,   50,    7,   8,   14,   14,   14,   14,   8,   14,   8,   14,  8,  16,  4,  4,  8,  10,  10,  10];
  const NCOLS = 21;

  const merges = [];
  const rows = [];
  let R = 1;

  // ── Fila 1: Título principal (A1:U1) ─────────────────────────────────────
  rows.push(Object.assign([
    t('PLANILLA DE CÒMPUTO Y PRESUPUESTO', S.hdrNavyLg),
    ...Array(NCOLS - 1).fill(e(S.hdrNavyLg))
  ], { _h: 24 }));
  addM(merges, R, 0, R, NCOLS - 1); R++;

  // ── Fila 2: COMITENTE ─────────────────────────────────────────────────────
  rows.push(Object.assign([
    t('COMITENTE', S.bold), e(), e(),
    t(form.cliente_nombre || 'GCBA - MINISTERIO DE EDUCACIÓN DE LA CIUDAD DE BUENOS AIRES - DGMESC', S.normal),
    ...Array(NCOLS - 4).fill(e())
  ], { _h: 15 }));
  addM(merges, R, 3, R, NCOLS - 1); R++;

  // ── Fila 3: LICITACIÓN ────────────────────────────────────────────────────
  rows.push(Object.assign([
    t('LICITACIÓN', S.bold), e(), e(),
    t(form.licitacion || '', S.normal),
    ...Array(NCOLS - 4).fill(e())
  ], { _h: 15 }));
  addM(merges, R, 3, R, NCOLS - 1); R++;

  // ── Fila 4: ZONA + EMPRESA + Nº PRESUPUESTO ───────────────────────────────
  rows.push(Object.assign([
    t(form.comuna || '', S.bold), e(),
    t('EMPRESA: MEJORES HOSPITALES S.A.', S.bold),
    e(), e(), e(), e(), e(), e(), e(), e(),
    t('Nº PRESUPUESTO', S.bold), e(), t(form.codigo || '', S.normal),
    ...Array(NCOLS - 14).fill(e())
  ], { _h: 15 }));
  addM(merges, R, 2, R, 10);
  addM(merges, R, 11, R, 12); R++;

  // ── Fila 5: DIRECCIÓN + FECHA ─────────────────────────────────────────────
  rows.push(Object.assign([
    e(), e(),
    t(`DIRECCIÓN: ${form.direccion_obra || ''}`, S.normal),
    e(), e(), e(), e(), e(), e(), e(), e(),
    t('FECHA ingreso sap', S.bold), e(), t(fmtDate(form.fecha_emision), S.normal),
    ...Array(NCOLS - 14).fill(e())
  ], { _h: 15 }));
  addM(merges, R, 2, R, 10);
  addM(merges, R, 11, R, 12); R++;

  // ── Fila 6: ESCUELA + PLAZO ───────────────────────────────────────────────
  rows.push(Object.assign([
    e(), e(),
    t(`ESCUELA: ${form.proyecto_nombre || ''}`, S.normal),
    e(), e(), e(), e(), e(), e(), e(), e(),
    t('PLAZO', S.bold), e(), t(form.plazo || '', S.normal),
    ...Array(NCOLS - 14).fill(e())
  ], { _h: 15 }));
  addM(merges, R, 2, R, 10);
  addM(merges, R, 11, R, 12); R++;

  // ── Fila 7: OBRA + Preciario Utilizado ────────────────────────────────────
  rows.push(Object.assign([
    e(), e(),
    t(`OBRA: ${form.titulo || ''}`, S.normal),
    e(), e(), e(), e(), e(), e(), e(), e(),
    t('Preciario Utilizado', S.bold), e(), t(fmtDate(form.preciario_fecha), S.normal),
    ...Array(NCOLS - 14).fill(e())
  ], { _h: 15 }));
  addM(merges, R, 2, R, 10);
  addM(merges, R, 11, R, 12); R++;

  // ── Fila 8: Coef Pase ─────────────────────────────────────────────────────
  rows.push(Object.assign([
    ...Array(11).fill(e()),
    t('Coef. Pase', S.bold), e(), num(coef_pase, S.normal),
    ...Array(NCOLS - 14).fill(e())
  ], { _h: 13 }));
  addM(merges, R, 11, R, 12); R++;

  // ── Fila 9: MTOM + SUPERVISOR + INSPECTOR + Coef Oferta ──────────────────
  rows.push(Object.assign([
    t('MTOM Nº', S.bold), e(), e(),
    t(`SUPERVISOR: ${form.responsable || 'Arq. Claudio Muñoz'}`, S.bold),
    e(), e(), e(), e(),
    t('INSPECTOR:', S.bold), e(), e(),
    t('Coef. Oferta', S.bold), e(), num(coef_oferta, S.normal),
    ...Array(NCOLS - 14).fill(e())
  ], { _h: 15 }));
  addM(merges, R, 3, R, 7);
  addM(merges, R, 8, R, 10);
  addM(merges, R, 11, R, 12); R++;

  // ── Fila 10: separador ────────────────────────────────────────────────────
  rows.push(Object.assign(Array(NCOLS).fill(e()), { _h: 5 })); R++;

  // ── Filas 11-12: Cabeceras de columna ─────────────────────────────────────
  // Fila 11: grupos
  rows.push(Object.assign([
    t('ITEM\nPRESUP',   S.hdrNavy),
    t('ITEM\nPRECIARIO', S.hdrNavy),
    t('DESCRIPCIÓN',   S.hdrNavy),
    t('CÓMPUTO',       S.hdrNavy), e(S.hdrNavy),
    t('PRECIOS UNITARIOS', S.hdrNavy), e(S.hdrNavy), e(S.hdrNavy),
    t('DEFLACIÓN DE MATERIALES\nFUERA DE PRECIARIO', S.hdrNavy), e(S.hdrNavy), e(S.hdrNavy),
    t('COEFICIENTE\nDE PASE',   S.hdrNavy), e(S.hdrNavy),
    t('COEFICIENTE\nOFERTA',    S.hdrNavy), e(S.hdrNavy),
    t('SUBTOTAL', S.hdrNavy), e(S.hdrNavy),
    t('AVANCE',  S.hdrNavy),
    t('PORCENTAJE\nDE AVANCE', S.hdrNavy), e(S.hdrNavy), e(S.hdrNavy),
  ], { _h: 40 }));
  addM(merges, R, 3, R, 4);   // CÓMPUTO
  addM(merges, R, 5, R, 7);   // PRECIOS UNITARIOS
  addM(merges, R, 8, R, 10);  // DEFLACIÓN
  addM(merges, R, 11, R, 12); // COEF PASE
  addM(merges, R, 13, R, 14); // COEF OFERTA
  addM(merges, R, 15, R, 16); // SUBTOTAL
  addM(merges, R, 18, R, 20); // PORCENTAJE AVANCE
  R++;

  // Fila 12: sub-headers
  rows.push(Object.assign([
    e(S.hdrBlue), e(S.hdrBlue), e(S.hdrBlue),
    t('UNID.',  S.hdrBlue), t('CANT.', S.hdrBlue),
    t('P.U.MAT.', S.hdrBlue), t('P.U.M.O.', S.hdrBlue), t('TOTAL', S.hdrBlue),
    t('PRECIO\nACTUAL SIN IVA', S.hdrBlue), t('COEFICIENTE\nDEFLACTOR', S.hdrBlue), t('PRECIO\nDEFLACIONADO', S.hdrBlue),
    t('COEFICIENTE', S.hdrBlue), t('TOTAL', S.hdrBlue),
    t('COEFICIENTE', S.hdrBlue), t('PRECIO\nRESULTANTE', S.hdrBlue),
    e(S.hdrBlue), e(S.hdrBlue),
    e(S.hdrBlue),
    t('ANTERIOR', S.hdrBlue), t('ACTUAL', S.hdrBlue), t('ACUMULADO', S.hdrBlue),
  ], { _h: 40 }));
  R++;

  // ── Ítems por rubro ───────────────────────────────────────────────────────
  // En el formato original, los rubros son "UBICACIÓN > RUBRO > ítems"
  // Como nuestro form tiene solo rubros (sin ubicaciones), los rubros son la ubicación
  let itemNum = 1;

  for (const rubro of rubros) {
    const rubroSubtotal = (rubro.items || []).reduce((a, i) => {
      const pu = (Number(i.pu_mat) || 0) + (Number(i.pu_mo) || 0);
      return a + pu * coef_pase * coef_oferta * (Number(i.cantidad) || 0);
    }, 0);

    // UBICACIÓN - ZONA DE TRABAJO (= el nombre del rubro como sección mayor)
    rows.push(Object.assign([
      t(`UBICACIÓN - ZONA DE TRABAJO: ${(rubro.nombre || '').toUpperCase()}`, S.ubicFill),
      ...Array(13).fill(e(S.ubicFill)),
      t('TOTAL', S.bold),
      num(rubroSubtotal, S.rowNumBlue),
      ...Array(5).fill(e(S.ubicFill))
    ], { _h: 18 }));
    addM(merges, R, 0, R, 13); R++;

    rows.push(Object.assign(Array(NCOLS).fill(e()), { _h: 4 })); R++;

    // RUBRO header (nombre del rubro)
    rows.push(Object.assign([
      t(`RUBRO: ${(rubro.nombre || '').toUpperCase()}`, S.rubroFill),
      ...Array(NCOLS - 1).fill(e(S.rubroFill))
    ], { _h: 16 }));
    addM(merges, R, 0, R, NCOLS - 1); R++;

    rows.push(Object.assign(Array(NCOLS).fill(e()), { _h: 4 })); R++;

    // Ítems
    for (const item of (rubro.items || [])) {
      const pu_mat   = Number(item.pu_mat)   || Number(item.precio_unitario) || 0;
      const pu_mo    = Number(item.pu_mo)    || 0;
      const total_pu = pu_mat + pu_mo;

      // Deflación: para ítems del preciario, precio actual es 0 (ya está en preciario)
      const defl_precio       = 0;
      const defl_deflacionado = 0;

      const total_pase   = total_pu * coef_pase;
      const total_oferta = total_pase * coef_oferta;

      rows.push(Object.assign([
        t(String(itemNum++),           S.rowCenter),   // A: ITEM PRESUP
        t(item.codigo || '',           S.rowNormal),   // B: ITEM PRECIARIO
        t(item.descripcion || '',      S.rowNormal),   // C: DESCRIPCIÓN
        t(item.unidad || '',           S.rowCenter),   // D: UNID.
        num(item.cantidad,             S.rowNum),      // E: CANT.
        num(pu_mat,                    S.rowNum),      // F: P.U.MAT.
        num(pu_mo,                     S.rowNum),      // G: P.U.M.O.
        num(total_pu,                  S.rowNum),      // H: TOTAL PU
        num(defl_precio,               S.rowNumOrange),// I: PRECIO ACTUAL SIN IVA (deflación)
        num(DEFLCOEF,                  S.rowNumOrange),// J: COEF. DEFLACTOR
        num(defl_deflacionado,         S.rowNumOrange),// K: PRECIO DEFLACIONADO
        num(coef_pase,                 S.rowCoef),     // L: COEF. PASE
        num(total_pase,                S.rowNum),      // M: TOTAL PASE
        num(coef_oferta,               S.rowCoef),     // N: COEF. OFERTA
        num(total_oferta,              S.rowNumYellow),// O: PRECIO RESULTANTE
        e(S.rowAvance),                                // P: vacío
        e(S.rowAvance),                                // Q: vacío
        num(0,                         S.rowPct),      // R: % AVANCE
        num(0,                         S.rowAvance),   // S: ANTERIOR
        num(0,                         S.rowAvance),   // T: ACTUAL
        num(0,                         S.rowAvance),   // U: ACUMULADO
      ], { _h: 14 }));
      R++;
    }

    rows.push(Object.assign(Array(NCOLS).fill(e()), { _h: 4 })); R++;
  }

  // ── GENERALES - VOLQUETES (vacíos, para completar a mano) ────────────────
  rows.push(Object.assign([
    t('GENERALES - VOLQUETES - ANDAMIOS - LIMPIEZA DE OBRA', S.sectionHdr),
    ...Array(13).fill(e(S.sectionHdr)),
    t('TOTAL', S.bold), num(0, S.rowNumBlue),
    ...Array(5).fill(e(S.sectionHdr))
  ], { _h: 18 }));
  addM(merges, R, 0, R, 13); R++;

  rows.push(Object.assign(Array(NCOLS).fill(e()), { _h: 4 })); R++;

  // 3 filas vacías para generales
  for (let i = 0; i < 3; i++) {
    rows.push(Object.assign([
      e(S.rowCenter), e(S.rowNormal), e(S.rowNormal), e(S.rowCenter),
      num(0, S.rowNum), num(0, S.rowNum), num(0, S.rowNum), num(0, S.rowNum),
      num(0, S.rowNumOrange), num(DEFLCOEF, S.rowNumOrange), num(0, S.rowNumOrange),
      num(coef_pase, S.rowCoef), num(0, S.rowNum),
      num(coef_oferta, S.rowCoef), num(0, S.rowNumYellow),
      e(S.rowAvance), e(S.rowAvance),
      num(0, S.rowPct), num(0, S.rowAvance), num(0, S.rowAvance), num(0, S.rowAvance),
    ], { _h: 14 }));
    R++;
  }

  rows.push(Object.assign(Array(NCOLS).fill(e()), { _h: 4 })); R++;

  // ── TOTAL PRESUPUESTO ─────────────────────────────────────────────────────
  const grandTotal = rubros.reduce((a, r) => a + (r.items || []).reduce((b, i) => {
    const pu = (Number(i.pu_mat) || 0) + (Number(i.pu_mo) || 0);
    return b + pu * coef_pase * coef_oferta * (Number(i.cantidad) || 0);
  }, 0), 0);

  rows.push(Object.assign(Array(NCOLS).fill(e()), { _h: 5 })); R++;

  rows.push(Object.assign([
    t('TOTAL PRESUPUESTO', S.hdrNavyLg),
    ...Array(14).fill(e(S.hdrNavyLg)),
    e(S.hdrNavyLg),
    num(grandTotal, S.totalNavy),
    ...Array(4).fill(e(S.hdrNavyLg))
  ], { _h: 24 }));
  addM(merges, R, 0, R, 14); R++;

  // ── Notas ─────────────────────────────────────────────────────────────────
  if (form.notas) {
    rows.push(Object.assign(Array(NCOLS).fill(e()), { _h: 8 })); R++;
    rows.push(Object.assign([
      t('NOTAS:', S.bold),
      t(form.notas, S.italic),
      ...Array(NCOLS - 2).fill(e())
    ], { _h: 16 }));
    addM(merges, R, 1, R, NCOLS - 1); R++;
  }

  // ── Generar archivo ───────────────────────────────────────────────────────
  const { xml: sheetXml, ss } = buildSheet(rows, colWidths, merges);
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
  a.download = `PCP_${form.codigo || 'presupuesto'}_MEJORES.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}