import jsPDF from 'jspdf';

// ── Paleta oficial ─────────────────────────────────────────────────────────────
const NAVY   = [10,  24,  52];
const NAVY2  = [29,  64,  96];
const GRAY1  = [30,  30,  30];
const GRAY2  = [80,  80,  80];
const GRAY3  = [140, 140, 140];
const GRAY4  = [210, 210, 210];
const WHITE  = [255, 255, 255];
const OFFWHT = [248, 250, 252];
const YELLOW = [255, 255, 200];
const GREEN  = [226, 239, 218];
const BLUE_H = [197, 217, 241];   // encabezado grupo columna
const BLUE_L = [221, 235, 247];   // sub-encabezado

const LOGO_URL = 'https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/b6844473f_mejores_cover.jpg';

// A4 apaisado
const PAGE_W = 297;
const PAGE_H = 210;
const ML = 7;   // margen izquierdo
const MR = 7;   // margen derecho
const C  = PAGE_W - ML - MR;  // 283 mm

// ────────────────────────────────────────────────────────────────────────────────
// COLUMNAS — réplica exacta del Excel 8A
// ÍTEM PRESUP | ÍTEM PRECIARIO | DESCRIPCIÓN | UNID | CANT
// PU MAT | PU MO | TOTAL (precios unit.)
// PRECIO ACTUAL SIN IVA | COEF DEFLACTOR | PRECIO DEFLACIONADO  (deflación)
// COEF PASE | TOTAL PASE
// COEF OFERTA | PRECIO RESULTANTE
// SUBTOTAL
// ────────────────────────────────────────────────────────────────────────────────
const C_ITEM   = { x: ML,       w: 9  };
const C_COD    = { x: ML+9,     w: 16 };
const C_DESC   = { x: ML+25,    w: 58 };
const C_UNID   = { x: ML+83,    w: 9  };
const C_CANT   = { x: ML+92,    w: 11 };
// precios unitarios
const C_PUMAT  = { x: ML+103,   w: 16 };
const C_PUMO   = { x: ML+119,   w: 16 };
const C_PUTOT  = { x: ML+135,   w: 16 };
// deflación
const C_DACT   = { x: ML+151,   w: 18 };
const C_DCOEF  = { x: ML+169,   w: 12 };
const C_DDEF   = { x: ML+181,   w: 16 };
// coef pase
const C_CPASE  = { x: ML+197,   w: 11 };
const C_TPASE  = { x: ML+208,   w: 17 };
// coef oferta
const C_COFER  = { x: ML+225,   w: 11 };
const C_RESULT = { x: ML+236,   w: 17 };
// subtotal (= precio resultante * cantidad)
const C_SUBT   = { x: ML+253,   w: 23 };

const ALL_COLS = [C_ITEM, C_COD, C_DESC, C_UNID, C_CANT,
                  C_PUMAT, C_PUMO, C_PUTOT,
                  C_DACT, C_DCOEF, C_DDEF,
                  C_CPASE, C_TPASE,
                  C_COFER, C_RESULT, C_SUBT];

// ── helpers ────────────────────────────────────────────────────────────────────
function fmtN(n, dec = 2) {
  if (!n && n !== 0) return '';
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: dec, minimumFractionDigits: dec }).format(n);
}
function fmtMoney(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);
}
function fmtDate(d) {
  try { if (!d) return '—'; const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; }
  catch { return d || '—'; }
}

async function loadLogo() {
  try {
    const res = await fetch(LOGO_URL);
    const blob = await res.blob();
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

// ── Cabecera de página ─────────────────────────────────────────────────────────
function drawPageHeader(doc, form, logo, pageNum) {
  // Barra navy
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 13, 'F');

  if (logo && pageNum === 1) {
    doc.addImage(logo, 'JPEG', ML, 0.5, 32, 12);
  }

  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('PLANILLA DE CÓMPUTO Y PRESUPUESTO', PAGE_W / 2, 8.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.text(`${form.codigo || ''} · Pág. ${pageNum}`, PAGE_W - MR, 8.5, { align: 'right' });

  return 15;
}

// ── Bloque de metadatos (replica el encabezado del Excel) ──────────────────────
function drawMetaBlock(doc, form, y) {
  const ROW = 5.5;
  const rows = 6;
  const blockH = rows * ROW + 4;

  // Fondo
  doc.setFillColor(...OFFWHT);
  doc.rect(ML, y, C, blockH, 'F');
  doc.setDrawColor(...GRAY4); doc.setLineWidth(0.15);
  doc.rect(ML, y, C, blockH);

  // Divisor vertical central
  const mid = ML + C / 2;
  doc.line(mid, y, mid, y + blockH);

  const left = [
    ['COMITENTE:',   form.cliente_nombre || 'GCBA - MINISTERIO DE EDUCACIÓN DE LA CIUDAD DE BUENOS AIRES - DGMESC'],
    ['LICITACIÓN:',  form.licitacion || '—'],
    ['ESCUELA:',     form.proyecto_nombre || '—'],
    ['OBRA:',        form.titulo || '—'],
    ['DIRECCIÓN:',   form.direccion_obra || '—'],
    ['SUPERVISOR:',  form.responsable || '—'],
  ];
  const right = [
    ['Nº PRESUPUESTO:',  form.codigo || '—'],
    ['EMPRESA:',         'MEJORES HOSPITALES S.A.'],
    ['FECHA ingreso SAP:', fmtDate(form.fecha_emision)],
    ['PLAZO:',           form.plazo || '—'],
    ['Preciario Utilizado:', fmtDate(form.preciario_fecha)],
    ['Coef. Pase:',      fmtN(form.coef_pase ?? 1.6504, 4)],
    ['Coef. Oferta:',    fmtN(form.coef_oferta ?? 1.38, 2)],
  ];

  const lx1 = ML + 2, lx2 = ML + 30;
  const rx1 = mid + 2, rx2 = mid + 38;

  left.forEach(([lbl, val], i) => {
    const ry = y + 4 + i * ROW;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(5.8); doc.setTextColor(...GRAY3);
    doc.text(lbl, lx1, ry);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.2); doc.setTextColor(...GRAY1);
    doc.text(doc.splitTextToSize(val, mid - lx2 - 2)[0], lx2, ry);
  });
  right.forEach(([lbl, val], i) => {
    const ry = y + 4 + i * ROW;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(5.8); doc.setTextColor(...GRAY3);
    doc.text(lbl, rx1, ry);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.2); doc.setTextColor(...GRAY1);
    doc.text(String(val), rx2, ry);
  });

  // MTOM N° + Inspector en fila inferior
  const mtomY = y + blockH - ROW;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(5.8); doc.setTextColor(...GRAY3);
  doc.text('MTOM Nº:', lx1, mtomY);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(5.8); doc.setTextColor(...GRAY3);
  doc.text('INSPECTOR:', rx1, mtomY);

  return y + blockH + 3;
}

// ── Cabecera de tabla (3 filas: grupos + subgrupos + sub-col) ──────────────────
function drawTableHeader(doc, y) {
  const H1 = 5.5, H2 = 5, H3 = 5;

  // ── Fila 1: grupos de columnas ──────────────────────────────────────────────
  doc.setFillColor(...NAVY);
  doc.rect(ML, y, C, H1, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(5); doc.setTextColor(...WHITE);

  const centerOf = (cols) => cols[0].x + cols.reduce((a, c) => a + c.w, 0) / 2;
  const rightEdge = (col) => col.x + col.w;

  doc.text('ÍTEM', C_ITEM.x + C_ITEM.w / 2, y + 3.8, { align: 'center' });
  doc.text('ÍTEM', C_COD.x + C_COD.w / 2, y + 3.8, { align: 'center' });
  doc.text('DESCRIPCIÓN', C_DESC.x + C_DESC.w / 2, y + 3.8, { align: 'center' });
  doc.text('UNID.', C_UNID.x + C_UNID.w / 2, y + 3.8, { align: 'center' });
  doc.text('CANT.', C_CANT.x + C_CANT.w / 2, y + 3.8, { align: 'center' });
  doc.text('PRECIOS UNITARIOS', centerOf([C_PUMAT, C_PUMO, C_PUTOT]), y + 3.8, { align: 'center' });
  doc.text('DEFLACIÓN DE MATERIALES FUERA DE PRECIARIO', centerOf([C_DACT, C_DCOEF, C_DDEF]), y + 3.8, { align: 'center' });
  doc.text('COEF. DE PASE', centerOf([C_CPASE, C_TPASE]), y + 3.8, { align: 'center' });
  doc.text('COEF. OFERTA', centerOf([C_COFER, C_RESULT]), y + 3.8, { align: 'center' });
  doc.text('SUBTOTAL', C_SUBT.x + C_SUBT.w / 2, y + 3.8, { align: 'center' });
  y += H1;

  // ── Fila 2: sub-encabezados ────────────────────────────────────────────────
  doc.setFillColor(...BLUE_H);
  doc.rect(ML, y, C, H2, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(4.5); doc.setTextColor(...NAVY);

  const subH = [
    ['PRESUP.', C_ITEM],
    ['PRECIARIO', C_COD],
    ['', C_DESC],
    ['', C_UNID],
    ['', C_CANT],
    ['P.U. MAT.', C_PUMAT],
    ['P.U. M.O.', C_PUMO],
    ['TOTAL', C_PUTOT],
    ['PRECIO ACTUAL\nSIN IVA', C_DACT],
    ['COEF.\nDEFLACTOR', C_DCOEF],
    ['PRECIO\nDEFLACIONADO', C_DDEF],
    ['COEF.', C_CPASE],
    ['TOTAL', C_TPASE],
    ['COEF.', C_COFER],
    ['PRECIO\nRESULTANTE', C_RESULT],
    ['AVANCE', C_SUBT],
  ];

  subH.forEach(([lbl, col]) => {
    if (!lbl) return;
    const lines = lbl.split('\n');
    if (lines.length > 1) {
      doc.text(lines[0], col.x + col.w / 2, y + 2, { align: 'center' });
      doc.text(lines[1], col.x + col.w / 2, y + 4, { align: 'center' });
    } else {
      doc.text(lbl, col.x + col.w / 2, y + 3.2, { align: 'center' });
    }
  });
  y += H2;

  // ── Fila 3: segunda sub-fila para las columnas de DEFLACIÓN ────────────────
  doc.setFillColor(...BLUE_L);
  doc.rect(ML, y, C, H3, 'F');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(4); doc.setTextColor(...NAVY2);
  // Separadores verticales
  doc.setDrawColor(...GRAY4); doc.setLineWidth(0.1);
  ALL_COLS.forEach((col, i) => {
    if (i > 0) doc.line(col.x, y - H1 - H2, col.x, y + H3);
  });
  doc.line(PAGE_W - MR, y - H1 - H2, PAGE_W - MR, y + H3);
  y += H3;

  return y;
}

// ── Encabezado de ubicación / zona ─────────────────────────────────────────────
function drawUbicacion(doc, nombre, total, y) {
  doc.setFillColor(...NAVY);
  doc.rect(ML, y, C, 6.5, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...WHITE);
  doc.text((nombre || 'UBICACIÓN - ZONA DE TRABAJO').toUpperCase(), ML + 3, y + 4.5);
  doc.text(`TOTAL  ${fmtMoney(total)}`, PAGE_W - MR - 2, y + 4.5, { align: 'right' });
  return y + 7;
}

// ── Encabezado de rubro ────────────────────────────────────────────────────────
function drawRubroHeader(doc, nombre, y) {
  doc.setFillColor(...BLUE_H);
  doc.rect(ML, y, C, 5.5, 'F');
  doc.setFillColor(...NAVY2);
  doc.rect(ML, y, 2, 5.5, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...NAVY);
  doc.text((nombre || 'RUBRO').toUpperCase(), ML + 4, y + 4);
  return y + 6;
}

// ── Fila de ítem ───────────────────────────────────────────────────────────────
function drawItemRow(doc, item, y, isAlt, cp, co, coefDeflactor) {
  const ROW_H = 5.5;

  if (isAlt) { doc.setFillColor(245, 247, 250); doc.rect(ML, y, C, ROW_H, 'F'); }

  const pu_mat   = Number(item.pu_mat) || Number(item.precio_unitario) || 0;
  const pu_mo    = Number(item.pu_mo)  || 0;
  const pu_total = pu_mat + pu_mo;

  // Deflación: sólo aplica si el ítem tiene precio fuera del preciario
  const d_actual     = 0;          // precio actual sin IVA (fuera preciario) — vacío si no aplica
  const d_coef       = coefDeflactor || 6.37;
  const d_deflac     = d_actual > 0 ? d_actual / d_coef : 0;

  // Si hay deflación, base para coef pase es d_deflac; sino es pu_total
  const base_pase    = d_deflac > 0 ? d_deflac : pu_total;
  const total_pase   = base_pase * cp;
  const precio_resul = total_pase * co;
  const subtotal     = precio_resul * (Number(item.cantidad) || 0);

  // Fondo amarillo en precio resultante y subtotal
  doc.setFillColor(...YELLOW);
  doc.rect(C_RESULT.x, y, C_RESULT.w, ROW_H, 'F');
  doc.rect(C_SUBT.x, y, C_SUBT.w, ROW_H, 'F');

  doc.setFont('helvetica', 'normal'); doc.setFontSize(5.8); doc.setTextColor(...GRAY1);

  const ctr = (txt, col) => doc.text(String(txt), col.x + col.w / 2, y + 3.8, { align: 'center' });
  const rgt = (val, col, dec = 2) => {
    if (val === 0 || !val) return;
    doc.text(fmtN(val, dec), col.x + col.w - 1, y + 3.8, { align: 'right' });
  };

  ctr(item._num || '', C_ITEM);
  doc.text(item.codigo || '', C_COD.x + 1, y + 3.8);

  // Descripción: recortar al ancho
  const desc = doc.splitTextToSize(item.descripcion || '', C_DESC.w - 2)[0];
  doc.text(desc, C_DESC.x + 1, y + 3.8);

  ctr(item.unidad || '', C_UNID);
  rgt(item.cantidad,  C_CANT);
  rgt(pu_mat,         C_PUMAT);
  rgt(pu_mo,          C_PUMO);
  rgt(pu_total,       C_PUTOT);

  // deflación (en blanco si no aplica)
  if (d_actual > 0) {
    rgt(d_actual,  C_DACT);
    rgt(d_coef,    C_DCOEF, 2);
    rgt(d_deflac,  C_DDEF);
  }

  doc.setTextColor(...GRAY2);
  rgt(cp,           C_CPASE, 4);
  rgt(total_pase,   C_TPASE);
  rgt(co,           C_COFER, 2);

  doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY);
  rgt(precio_resul, C_RESULT);
  rgt(subtotal,     C_SUBT);

  // Línea separadora
  doc.setDrawColor(...GRAY4); doc.setLineWidth(0.08);
  doc.line(ML, y + ROW_H, PAGE_W - MR, y + ROW_H);

  return y + ROW_H;
}

// ── Subtotal de rubro ──────────────────────────────────────────────────────────
function drawRubroSubtotal(doc, rubro, y, cp, co) {
  const sub = (rubro.items || []).reduce((a, i) => {
    const pu_mat  = Number(i.pu_mat) || Number(i.precio_unitario) || 0;
    const pu_mo   = Number(i.pu_mo) || 0;
    const result  = (pu_mat + pu_mo) * cp * co;
    return a + result * (Number(i.cantidad) || 0);
  }, 0);
  doc.setFillColor(...GREEN);
  doc.rect(ML, y, C, 5, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(...NAVY2);
  doc.text(`Subtotal ${(rubro.nombre || '').toUpperCase()}`, ML + 2, y + 3.5);
  doc.text(fmtMoney(sub), PAGE_W - MR - 1, y + 3.5, { align: 'right' });
  return y + 5.5;
}

// ── Total presupuesto ──────────────────────────────────────────────────────────
function drawTotalRow(doc, total, y) {
  doc.setFillColor(...NAVY);
  doc.rect(ML, y, C, 7, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...WHITE);
  doc.text('TOTAL PRESUPUESTO', ML + 3, y + 5);
  doc.text(fmtMoney(total), PAGE_W - MR - 2, y + 5, { align: 'right' });
  return y + 8;
}

// ── Sección de redeterminación ─────────────────────────────────────────────────
function drawRedeterminacion(doc, form, total, y) {
  y += 6;
  doc.setDrawColor(...GRAY4); doc.setLineWidth(0.2);
  doc.line(ML, y, PAGE_W - MR, y);
  y += 4;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...NAVY);
  doc.text('REDETERMINACIÓN', ML, y);
  y += 5;

  const cp    = form.coef_pase   ?? 1.6504;
  const co    = form.coef_oferta ?? 1.38;
  const redPct = form.redeterminacion_pct ?? 0;
  const redCoef = redPct ? 1 + redPct / 100 : 1;

  const rows = [
    ['Costo de obra a valor actual:', fmtMoney(total)],
    ['Coef. Redeterminación:', fmtN(redCoef, 4)],
    ['Precio venta a valores base contractual:', fmtMoney(total)],
    ['Coef. Pase:', fmtN(cp, 4)],
    ['Coef. Oferta:', fmtN(co, 2)],
  ];

  const bx = ML + C - 110;
  rows.forEach(([lbl, val], i) => {
    const ry = y + i * 5.5;
    if (i % 2 === 0) { doc.setFillColor(...OFFWHT); doc.rect(bx, ry - 1, 110, 5.5, 'F'); }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.2); doc.setTextColor(...GRAY2);
    doc.text(lbl, bx + 2, ry + 2.8);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...GRAY1);
    doc.text(val, PAGE_W - MR - 2, ry + 2.8, { align: 'right' });
  });

  return y + rows.length * 5.5 + 5;
}

// ── Notas ──────────────────────────────────────────────────────────────────────
function drawNotas(doc, notas, y) {
  if (!notas) return y;
  y += 4;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...NAVY);
  doc.text('NOTAS Y CONDICIONES:', ML, y); y += 4;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...GRAY2);
  const lines = doc.splitTextToSize(notas, C - 4);
  doc.text(lines, ML + 2, y);
  return y + lines.length * 4;
}

// ── Pie de página ─────────────────────────────────────────────────────────────
function drawFooter(doc, form, pageNum, totalPages) {
  doc.setFillColor(...NAVY);
  doc.rect(0, PAGE_H - 7, PAGE_W, 7, 'F');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); doc.setTextColor(...WHITE);
  doc.text('MEJORES HOSPITALES S.A.  ·  mantenimiento, obras y servicios', ML, PAGE_H - 2.5);
  doc.text(
    `${form.codigo || 'PRESUPUESTO'}  ·  ${form.licitacion || ''}  ·  Pág. ${pageNum} / ${totalPages}`,
    PAGE_W - MR, PAGE_H - 2.5, { align: 'right' }
  );
}

// ── FUNCIÓN PRINCIPAL ─────────────────────────────────────────────────────────
export async function generatePresupuestoPDF(form) {
  const logo     = await loadLogo();
  const doc      = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const rubros   = form.rubros || [];
  const cp       = form.coef_pase   ?? 1.6504;
  const co       = form.coef_oferta ?? 1.38;
  const coefDef  = 6.37;
  const SAFE_BOTTOM = PAGE_H - 10;

  let pageNum = 1;

  const ensureSpace = (needed) => {
    if (y + needed > SAFE_BOTTOM) {
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

  for (const rubro of rubros) {
    ensureSpace(15);
    y = drawRubroHeader(doc, rubro.nombre, y);

    for (const item of (rubro.items || [])) {
      ensureSpace(6);
      item._num = globalIdx++;
      y = drawItemRow(doc, item, y, globalIdx % 2 === 0, cp, co, coefDef);
    }

    ensureSpace(6);
    y = drawRubroSubtotal(doc, rubro, y, cp, co);
    y += 2;
  }

  // Total general
  const totalGeneral = rubros.reduce((acc, r) =>
    acc + (r.items || []).reduce((a, i) => {
      const pu = (Number(i.pu_mat) || Number(i.precio_unitario) || 0) + (Number(i.pu_mo) || 0);
      return a + pu * cp * co * (Number(i.cantidad) || 0);
    }, 0), 0);

  ensureSpace(10);
  y = drawTotalRow(doc, totalGeneral, y);

  // Generales / Volquetes / Limpieza (si hay notas en ese campo)
  if (form.notas_generales) {
    ensureSpace(30);
    y = drawNotas(doc, form.notas_generales, y);
  }

  // Redeterminación
  ensureSpace(50);
  y = drawRedeterminacion(doc, form, totalGeneral, y);

  // Notas finales
  if (form.notas) {
    ensureSpace(20);
    y = drawNotas(doc, form.notas, y);
  }

  // Pies definitivos
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(doc, form, p, totalPages);
  }

  doc.save(`PCP_${form.codigo || 'presupuesto'}_MEJORES.pdf`);
}