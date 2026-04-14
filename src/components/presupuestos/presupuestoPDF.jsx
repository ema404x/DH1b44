import jsPDF from 'jspdf';

// ─────────────────────────────────────────────────────────────────────────────
// PALETA EXACTA — idéntica al Excel (mismos valores hex → RGB)
// ─────────────────────────────────────────────────────────────────────────────
const NAVY     = [15,  28,  46];   // 0F1C2E  — header / total bg
const NAVY2    = [26,  58,  92];   // 1A3A5C  — labels meta
const BLUE_H   = [31,  78, 121];   // 1F4E79  — encabezado tabla fila 1
const BLUE_S   = [189, 215, 238];  // BDD7EE  — encabezado tabla fila 2
const UBIC_BG  = [46, 117, 182];   // 2E75B6  — generales header
const RUBRO_BG = [218, 238, 243];  // DAEEF3  — rubro header bg
const RUBRO_F  = [23,  55,  94];   // 17375E  — rubro font
const ALT_BG   = [235, 244, 251];  // EBF4FB  — fila alterna
const DEFL_BG  = [252, 228, 214];  // FCE4D6  — deflación naranja claro
const YELLOW   = [255, 255, 153];  // FFFF99  — precio resultante / subtotal
const GREEN    = [226, 239, 218];  // E2EFDA  — subtotal rubro
const GRAY_L   = [242, 242, 242];  // F2F2F2  — generales filas
const WHITE    = [255, 255, 255];
const WHITE_T  = [255, 255, 255];  // texto blanco
const DARK_T   = [29,  29,  29];   // 1D1D1D  — texto general
const GRAY_T   = [128, 128, 128];  // 808080  — texto secundario

const LOGO_URL = 'https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/b6844473f_mejores_cover.jpg';

const PAGE_W = 297;
const PAGE_H = 210;
const ML = 6;
const MR = 6;
const TW = PAGE_W - ML - MR;  // ancho útil = 285

// ─── Columnas exactas (mm) ───────────────────────────────────────────────────
// A  ITEM PRESUP   B  ITEM PRECIARIO  C  DESCRIPCIÓN   D  UNID  E  CANT
// F  PU MAT        G  PU MO           H  TOTAL PU
// I  PRECIO ACT    J  COEF DEFL       K  PRECIO DEFL
// L  COEF PASE     M  TOTAL PASE
// N  COEF OFERTA   O  PRECIO RESULT
// P  SUBTOTAL
// Q  % AVANCE      R  ANTERIOR        S  ACTUAL        T  ACUMULADO
const COLS = [
  { w:  8 }, // A  ITEM PRESUP
  { w: 13 }, // B  ITEM PRECIARIO
  { w: 52 }, // C  DESCRIPCIÓN
  { w:  8 }, // D  UNID
  { w: 10 }, // E  CANT
  { w: 14 }, // F  PU MAT
  { w: 14 }, // G  PU MO
  { w: 14 }, // H  TOTAL PU
  { w: 16 }, // I  PRECIO ACT SIN IVA
  { w: 10 }, // J  COEF DEFLACTOR
  { w: 14 }, // K  PRECIO DEFLACIONADO
  { w: 10 }, // L  COEF PASE
  { w: 15 }, // M  TOTAL PASE
  { w: 10 }, // N  COEF OFERTA
  { w: 16 }, // O  PRECIO RESULTANTE
  { w: 17 }, // P  SUBTOTAL
  { w:  7 }, // Q  %
  { w: 12 }, // R  ANTERIOR
  { w: 12 }, // S  ACTUAL
  { w: 12 }, // T  ACUMULADO
];

// Precalcular x acumulado
let _x = ML;
COLS.forEach(c => { c.x = _x; _x += c.w; });

const COL = (i) => COLS[i]; // alias

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtN = (n, d = 2) => {
  if (n == null || n === '') return '';
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
};
const fmtARS = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) => {
  if (!d) return '';
  try { const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}`; } catch { return d; }
};

async function loadLogo() {
  try {
    const r = await fetch(LOGO_URL);
    const blob = await r.blob();
    return new Promise(res => {
      const rd = new FileReader();
      rd.onloadend = () => res(rd.result);
      rd.readAsDataURL(blob);
    });
  } catch { return null; }
}

// ─── Primitivos de dibujo ────────────────────────────────────────────────────
function fillRect(doc, rgb, x, y, w, h) {
  doc.setFillColor(...rgb);
  doc.rect(x, y, w, h, 'F');
}

function hline(doc, y, x1, x2) {
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.08);
  doc.line(x1, y, x2, y);
}

// Texto derecha dentro de columna i
function rtext(doc, val, colIdx, y, rgb) {
  if (val == null || val === '' || val === 0) return;
  doc.setTextColor(...rgb);
  const c = COL(colIdx);
  doc.text(String(val), c.x + c.w - 0.8, y, { align: 'right' });
}
// Texto centro
function ctext(doc, val, colIdx, y, rgb) {
  if (val == null || val === '') return;
  doc.setTextColor(...rgb);
  const c = COL(colIdx);
  doc.text(String(val), c.x + c.w / 2, y, { align: 'center' });
}
// Texto izquierda
function ltext(doc, val, colIdx, y, rgb, maxW) {
  if (val == null || val === '') return;
  doc.setTextColor(...rgb);
  const c = COL(colIdx);
  const txt = maxW ? doc.splitTextToSize(String(val), maxW)[0] : String(val);
  doc.text(txt, c.x + 1, y);
}

// Separadores verticales para todas las columnas
function vlines(doc, y1, y2) {
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.07);
  COLS.forEach((c, i) => {
    if (i > 0) doc.line(c.x, y1, c.x, y2);
  });
  doc.line(ML + TW, y1, ML + TW, y2);
}

// ─────────────────────────────────────────────────────────────────────────────
// CABECERA DE PÁGINA
// ─────────────────────────────────────────────────────────────────────────────
function drawPageHeader(doc, form, logo, pageNum) {
  // Barra NAVY completa
  fillRect(doc, NAVY, 0, 0, PAGE_W, 14);

  if (logo && pageNum === 1) {
    doc.addImage(logo, 'JPEG', ML, 0.8, 30, 12);
  }

  doc.setTextColor(...WHITE_T);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('PLANILLA DE CÓMPUTO Y PRESUPUESTO', PAGE_W / 2, 9, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.text(`${form.codigo || ''} · Pág. ${pageNum}`, PAGE_W - MR, 9, { align: 'right' });

  return 16; // y siguiente
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE DE METADATOS
// ─────────────────────────────────────────────────────────────────────────────
function drawMetaBlock(doc, form, y0) {
  const ROW_H = 5.2;
  const LEFT_W = TW * 0.55;
  const RIGHT_W = TW - LEFT_W;
  const lx = ML; const rx = ML + LEFT_W;
  const lbl_fs = 5.5; const val_fs = 6;
  const LBL_W = 32; const VAL_OFF = 34;

  // Fondo general
  fillRect(doc, [248, 250, 252], ML, y0, TW, ROW_H * 9);
  doc.setDrawColor(...[210, 210, 210]);
  doc.setLineWidth(0.15);
  doc.rect(ML, y0, TW, ROW_H * 9);
  // Línea divisoria vertical
  doc.line(rx, y0, rx, y0 + ROW_H * 9);

  const leftRows = [
    ['COMITENTE:',   form.cliente_nombre || 'GCBA - MINISTERIO DE EDUCACIÓN DE LA CIUDAD DE BUENOS AIRES'],
    ['LICITACIÓN:',  form.licitacion || ''],
    ['ESCUELA:',     form.proyecto_nombre || ''],
    ['OBRA:',        form.titulo || ''],
    ['DIRECCIÓN:',   form.direccion_obra || ''],
    ['SUPERVISOR:',  form.responsable || ''],
    ['INSPECTOR:',   form.inspector || ''],
    ['MTOM Nº:',     form.mtom || ''],
  ];
  const rightRows = [
    ['Nº PRESUPUESTO:',     form.codigo || ''],
    ['EMPRESA:',            'MEJORES HOSPITALES S.A.'],
    ['FECHA ingreso SAP:',  fmtDate(form.fecha_emision)],
    ['PLAZO:',              form.plazo ? `${form.plazo} días` : ''],
    ['Preciario:',          fmtDate(form.preciario_fecha)],
    ['Coef. Pase:',         fmtN(form.coef_pase ?? 1.6504, 4)],
    ['Coef. Oferta:',       fmtN(form.coef_oferta ?? 1.38, 2)],
    ['',                    ''],
  ];

  leftRows.forEach(([lbl, val], i) => {
    const ry = y0 + 3.8 + i * ROW_H;
    doc.setFont('helvetica', 'bold');   doc.setFontSize(lbl_fs); doc.setTextColor(...[140, 140, 140]);
    doc.text(lbl, lx + 1.5, ry);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(val_fs);  doc.setTextColor(...DARK_T);
    doc.text(doc.splitTextToSize(val, LEFT_W - VAL_OFF - 2)[0], lx + VAL_OFF, ry);
  });

  rightRows.forEach(([lbl, val], i) => {
    const ry = y0 + 3.8 + i * ROW_H;
    doc.setFont('helvetica', 'bold');   doc.setFontSize(lbl_fs); doc.setTextColor(...[140, 140, 140]);
    doc.text(lbl, rx + 1.5, ry);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(val_fs);  doc.setTextColor(...DARK_T);
    doc.text(String(val), rx + 38, ry);
  });

  return y0 + ROW_H * 9 + 2;
}

// ─────────────────────────────────────────────────────────────────────────────
// CABECERA DE TABLA (2 filas de encabezados)
// ─────────────────────────────────────────────────────────────────────────────
function drawTableHeader(doc, y) {
  const H1 = 5.5;  // fila 1: grupos
  const H2 = 5.0;  // fila 2: sub-columnas

  // ── Fila 1: fondos por grupo ────────────────────────────────────────────────
  fillRect(doc, NAVY, ML, y, TW, H1);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(4.8); doc.setTextColor(...WHITE_T);

  // grupos
  const g1y = y + H1 / 2 + 1.5;
  ctext(doc, 'ÍTEM\nPRESUP',   0, g1y - 1, WHITE_T);
  doc.text('ÍTEM', COL(0).x + COL(0).w/2, g1y - 1, { align:'center' });
  ctext(doc, 'ÍTEM\nPRECIARIO', 1, g1y - 1, WHITE_T);
  ctext(doc, 'DESCRIPCIÓN', 2, g1y, WHITE_T);
  ctext(doc, 'UNID.', 3, g1y, WHITE_T);
  ctext(doc, 'CANT.', 4, g1y, WHITE_T);

  // Grupo PRECIOS UNITARIOS (cols 5,6,7)
  const gruF = COL(5).x; const gruT = COL(7).x + COL(7).w;
  doc.text('PRECIOS UNITARIOS', (gruF + gruT) / 2, g1y, { align: 'center' });

  // Grupo DEFLACIÓN (cols 8,9,10)
  const defF = COL(8).x; const defT = COL(10).x + COL(10).w;
  fillRect(doc, DEFL_BG, defF, y, defT - defF, H1);
  doc.setTextColor(...RUBRO_F);
  doc.text('DEFLACIÓN DE MATERIALES', (defF + defT) / 2, g1y - 0.5, { align: 'center' });
  doc.text('FUERA DE PRECIARIO', (defF + defT) / 2, g1y + 2, { align: 'center' });
  doc.setTextColor(...WHITE_T);

  // Grupo COEF PASE (cols 11,12)
  const cpF = COL(11).x; const cpT = COL(12).x + COL(12).w;
  doc.text('COEF. DE PASE', (cpF + cpT) / 2, g1y, { align: 'center' });

  // Grupo COEF OFERTA (cols 13,14)
  const coF = COL(13).x; const coT = COL(14).x + COL(14).w;
  doc.text('COEF. OFERTA', (coF + coT) / 2, g1y, { align: 'center' });

  // SUBTOTAL (col 15)
  ctext(doc, 'SUBTOTAL', 15, g1y, WHITE_T);

  // AVANCE (cols 16..19)
  const avF = COL(16).x; const avT = COL(19).x + COL(19).w;
  doc.text('AVANCE', (avF + avT) / 2, g1y, { align: 'center' });

  y += H1;

  // ── Fila 2: sub-columnas ────────────────────────────────────────────────────
  fillRect(doc, BLUE_S, ML, y, TW, H2);
  // Fondo especial deflación
  fillRect(doc, DEFL_BG, COL(8).x, y, COL(10).x + COL(10).w - COL(8).x, H2);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(4.5);
  const h2y = y + H2 / 2 + 1.5;

  const subCols = [
    [0,  'PRESUP.',        BLUE_H],
    [1,  'PRECIARIO',      BLUE_H],
    [2,  '',               BLUE_H],
    [3,  '',               BLUE_H],
    [4,  '',               BLUE_H],
    [5,  'P.U. MAT.',      BLUE_H],
    [6,  'P.U. M.O.',      BLUE_H],
    [7,  'TOTAL',          BLUE_H],
    [8,  'PRECIO ACTUAL\nSIN IVA',      [80,40,0]],
    [9,  'COEF.\nDEFLACTOR',            [80,40,0]],
    [10, 'PRECIO\nDEFLACIONADO',        [80,40,0]],
    [11, 'COEF.',          BLUE_H],
    [12, 'TOTAL',          BLUE_H],
    [13, 'COEF.',          BLUE_H],
    [14, 'PRECIO\nRESULTANTE', BLUE_H],
    [15, '',               BLUE_H],
    [16, '% AV.',          BLUE_H],
    [17, 'ANTERIOR',       BLUE_H],
    [18, 'ACTUAL',         BLUE_H],
    [19, 'ACUMULADO',      BLUE_H],
  ];

  subCols.forEach(([ci, lbl, rgb]) => {
    if (!lbl) return;
    doc.setTextColor(...rgb);
    const lines = lbl.split('\n');
    const c = COL(ci);
    if (lines.length === 2) {
      doc.text(lines[0], c.x + c.w/2, h2y - 1.5, { align: 'center' });
      doc.text(lines[1], c.x + c.w/2, h2y + 0.8, { align: 'center' });
    } else {
      doc.text(lbl, c.x + c.w/2, h2y, { align: 'center' });
    }
  });

  y += H2;

  // Separadores verticales completos
  vlines(doc, y - H1 - H2, y);

  return y;
}

// ─────────────────────────────────────────────────────────────────────────────
// FILA DE RUBRO
// ─────────────────────────────────────────────────────────────────────────────
function drawRubroRow(doc, nombre, rubroTotal, y) {
  const H = 6;
  fillRect(doc, RUBRO_BG, ML, y, TW, H);
  // acento izquierdo
  fillRect(doc, NAVY2, ML, y, 2, H);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...RUBRO_F);
  doc.text((nombre || 'RUBRO').toUpperCase(), ML + 4, y + H / 2 + 2);
  doc.setTextColor(...RUBRO_F);
  doc.text(fmtARS(rubroTotal), PAGE_W - MR - 1, y + H / 2 + 2, { align: 'right' });
  hline(doc, y + H, ML, ML + TW);
  return y + H;
}

// ─────────────────────────────────────────────────────────────────────────────
// FILA DE ÍTEM
// ─────────────────────────────────────────────────────────────────────────────
function drawItemRow(doc, item, y, isAlt, cp, co) {
  const ROW_H = 5.5;
  const bg = isAlt ? ALT_BG : WHITE;
  fillRect(doc, bg, ML, y, TW, ROW_H);

  // Fondos especiales
  fillRect(doc, DEFL_BG, COL(8).x, y, COL(10).x + COL(10).w - COL(8).x, ROW_H);
  fillRect(doc, YELLOW, COL(14).x, y, COL(14).w, ROW_H);
  fillRect(doc, YELLOW, COL(15).x, y, COL(15).w, ROW_H);

  const pu_mat   = Number(item.pu_mat)  || 0;
  const pu_mo    = Number(item.pu_mo)   || 0;
  const pu_total = pu_mat + pu_mo;
  const tot_pase = pu_total * cp;
  const p_result = tot_pase * co;
  const subtotal = p_result * (Number(item.cantidad) || 0);

  const ty = y + ROW_H / 2 + 1.8;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(5.8);

  // A: #ítem
  ctext(doc, item._num || '', 0, ty, DARK_T);
  // B: código preciario
  ltext(doc, item.codigo || '', 1, ty, GRAY_T);
  // C: descripción (truncada al ancho)
  ltext(doc, item.descripcion || '', 2, ty, DARK_T, COL(2).w - 2);
  // D: unidad
  ctext(doc, item.unidad || '', 3, ty, DARK_T);
  // E: cantidad
  rtext(doc, fmtN(item.cantidad, 2), 4, ty, DARK_T);
  // F: PU MAT
  rtext(doc, pu_mat ? fmtN(pu_mat) : '', 5, ty, DARK_T);
  // G: PU MO
  rtext(doc, pu_mo  ? fmtN(pu_mo)  : '', 6, ty, DARK_T);
  // H: TOTAL PU
  doc.setFont('helvetica', 'bold');
  rtext(doc, pu_total ? fmtN(pu_total) : '', 7, ty, NAVY);
  doc.setFont('helvetica', 'normal');
  // I,J,K: deflación — vacío (gris)
  rtext(doc, '—', 8, ty, GRAY_T);
  rtext(doc, fmtN(6.37), 9, ty, GRAY_T);
  rtext(doc, '—', 10, ty, GRAY_T);
  // L: coef pase
  rtext(doc, fmtN(cp, 4), 11, ty, GRAY_T);
  // M: total pase
  rtext(doc, fmtN(tot_pase), 12, ty, DARK_T);
  // N: coef oferta
  rtext(doc, fmtN(co, 2), 13, ty, GRAY_T);
  // O: precio resultante — amarillo, bold
  doc.setFont('helvetica', 'bold');
  rtext(doc, fmtN(p_result), 14, ty, NAVY);
  // P: subtotal — amarillo, bold
  rtext(doc, fmtN(subtotal), 15, ty, NAVY);
  doc.setFont('helvetica', 'normal');

  // Q..T: avance (vacío)
  vlines(doc, y, y + ROW_H);
  hline(doc, y + ROW_H, ML, ML + TW);
  return y + ROW_H;
}

// ─────────────────────────────────────────────────────────────────────────────
// FILA SUBTOTAL RUBRO
// ─────────────────────────────────────────────────────────────────────────────
function drawSubtotalRubro(doc, nombre, total, y) {
  const H = 5.5;
  fillRect(doc, GREEN, ML, y, TW, H);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(...RUBRO_F);
  doc.text(`Subtotal ${(nombre || '').toUpperCase()}`, ML + 3, y + H / 2 + 2);
  doc.text(fmtARS(total), PAGE_W - MR - 1, y + H / 2 + 2, { align: 'right' });
  hline(doc, y + H, ML, ML + TW);
  return y + H + 1.5;
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE GENERALES
// ─────────────────────────────────────────────────────────────────────────────
function drawGenerales(doc, y) {
  const H_HDR = 6;
  fillRect(doc, UBIC_BG, ML, y, TW, H_HDR);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...WHITE_T);
  doc.text('GENERALES - VOLQUETES - ANDAMIOS - LIMPIEZA DE OBRA', ML + 3, y + H_HDR / 2 + 2);
  hline(doc, y + H_HDR, ML, ML + TW);
  y += H_HDR;

  const items = ['Andamios', 'Armado Andamios', 'Volquetes', 'Acarreo de materiales', 'Limpieza de Obra', 'Tramitaciones'];
  items.forEach((g, i) => {
    const H = 5;
    const bg = i % 2 === 0 ? GRAY_L : WHITE;
    fillRect(doc, bg, ML, y, TW, H);
    fillRect(doc, DEFL_BG, COL(8).x, y, COL(10).x + COL(10).w - COL(8).x, H);
    fillRect(doc, YELLOW, COL(14).x, y, COL(14).w, H);
    fillRect(doc, YELLOW, COL(15).x, y, COL(15).w, H);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5.8); doc.setTextColor(...DARK_T);
    doc.text(g, COL(2).x + 1, y + H / 2 + 1.8);
    vlines(doc, y, y + H);
    hline(doc, y + H, ML, ML + TW);
    y += H;
  });
  return y + 2;
}

// ─────────────────────────────────────────────────────────────────────────────
// FILA TOTAL PRESUPUESTO
// ─────────────────────────────────────────────────────────────────────────────
function drawTotal(doc, total, y) {
  const H = 8;
  fillRect(doc, NAVY, ML, y, TW, H);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...WHITE_T);
  doc.text('TOTAL PRESUPUESTO', ML + 3, y + H / 2 + 2.5);
  doc.setFontSize(8.5);
  doc.text(fmtARS(total), PAGE_W - MR - 1, y + H / 2 + 2.5, { align: 'right' });
  return y + H + 2;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN REDETERMINACIÓN
// ─────────────────────────────────────────────────────────────────────────────
function drawRedeterminacion(doc, form, total, y) {
  y += 5;
  doc.setDrawColor(...[210, 210, 210]); doc.setLineWidth(0.2);
  doc.line(ML, y, PAGE_W - MR, y);
  y += 5;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...NAVY2);
  doc.text('REDETERMINACIÓN', ML, y);
  y += 5;

  const cp = Number(form.coef_pase) || 1.6504;
  const co = Number(form.coef_oferta) || 1.38;
  const rows = [
    ['Costo de obra a valor actual (base contractual):', fmtARS(total)],
    ['Coef. Pase:', fmtN(cp, 4)],
    ['Coef. Oferta:', fmtN(co, 2)],
    ['Precio venta mínimo a valores base contractual:', fmtARS(total)],
  ];
  const bx = PAGE_W - MR - 120;
  rows.forEach(([lbl, val], i) => {
    const ry = y + i * 5.5;
    if (i % 2 === 0) fillRect(doc, [248, 250, 252], bx, ry - 1.5, 120, 5.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...[80, 80, 80]);
    doc.text(lbl, bx + 2, ry + 2);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...DARK_T);
    doc.text(val, PAGE_W - MR - 1, ry + 2, { align: 'right' });
  });
  return y + rows.length * 5.5 + 5;
}

// ─────────────────────────────────────────────────────────────────────────────
// PIE DE PÁGINA
// ─────────────────────────────────────────────────────────────────────────────
function drawFooter(doc, form, pageNum, totalPages) {
  fillRect(doc, NAVY, 0, PAGE_H - 7, PAGE_W, 7);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); doc.setTextColor(...WHITE_T);
  doc.text('MEJORES HOSPITALES S.A.  ·  mantenimiento, obras y servicios', ML, PAGE_H - 2.5);
  doc.text(
    `${form.codigo || ''}  ·  ${form.licitacion || ''}  ·  Pág. ${pageNum} / ${totalPages}`,
    PAGE_W - MR, PAGE_H - 2.5, { align: 'right' }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export async function generatePresupuestoPDF(form) {
  const logo    = await loadLogo();
  const doc     = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const rubros  = form.rubros || [];
  const cp      = Number(form.coef_pase)   || 1.6504;
  const co      = Number(form.coef_oferta) || 1.38;
  const SAFE    = PAGE_H - 9;
  let pageNum   = 1;

  const ensureSpace = (needed) => {
    if (y + needed > SAFE) {
      drawFooter(doc, form, pageNum, '??');
      doc.addPage(); pageNum++;
      y = drawPageHeader(doc, form, logo, pageNum);
      y = drawTableHeader(doc, y);
    }
  };

  let y = drawPageHeader(doc, form, logo, pageNum);
  y = drawMetaBlock(doc, form, y);
  y = drawTableHeader(doc, y);

  let globalIdx = 1;
  let grandTotal = 0;

  for (const rubro of rubros) {
    const rubroTotal = (rubro.items || []).reduce((a, item) => {
      const pu = (Number(item.pu_mat) || 0) + (Number(item.pu_mo) || 0);
      return a + pu * cp * co * (Number(item.cantidad) || 0);
    }, 0);
    grandTotal += rubroTotal;

    ensureSpace(12);
    y = drawRubroRow(doc, rubro.nombre, rubroTotal, y);

    for (const item of (rubro.items || [])) {
      ensureSpace(6);
      item._num = globalIdx++;
      y = drawItemRow(doc, item, y, globalIdx % 2 === 0, cp, co);
    }

    ensureSpace(7);
    y = drawSubtotalRubro(doc, rubro.nombre, rubroTotal, y);
  }

  // Generales
  ensureSpace(40);
  y = drawGenerales(doc, y);

  // Total
  ensureSpace(12);
  y = drawTotal(doc, grandTotal, y);

  // Redeterminación
  ensureSpace(45);
  y = drawRedeterminacion(doc, form, grandTotal, y);

  // Notas
  if (form.notas) {
    ensureSpace(20);
    y += 4;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...NAVY2);
    doc.text('NOTAS Y CONDICIONES:', ML, y); y += 4;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...[80, 80, 80]);
    const lines = doc.splitTextToSize(form.notas, TW - 4);
    doc.text(lines, ML + 2, y);
  }

  // Pies definitivos
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(doc, form, p, totalPages);
  }

  doc.save(`PCP_${form.codigo || 'presupuesto'}_MEJORES.pdf`);
}