import jsPDF from 'jspdf';

// ── Colores ───────────────────────────────────────────────────────────────────
const NAVY   = [10,  24,  52];   // #0A1834
const NAVY2  = [29,  64,  96];   // #1D4060
const BLUE   = [205, 225, 245];  // azul claro encabezado
const RED    = [192, 57,  43];
const WHITE  = [255, 255, 255];
const GRAY1  = [30,  30,  30];
const GRAY2  = [80,  80,  80];
const GRAY3  = [150, 150, 150];
const GRAY4  = [210, 210, 210];
const OFFWHT = [248, 250, 252];
const YELLOW = [255, 255, 200];
const GREEN  = [226, 239, 218];

const LOGO_URL = 'https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/b6844473f_mejores_cover.jpg';

const PAGE_W = 297;  // A4 landscape
const PAGE_H = 210;
const M = 10;        // margin
const C = PAGE_W - M * 2;

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

function fmtMoney(n) {
  return new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS', maximumFractionDigits:0 }).format(n || 0);
}

function fmtDate(d) {
  try { if (!d) return '—'; const [y,m,day] = d.split('-'); return `${day}/${m}/${y}`; }
  catch { return d || '—'; }
}

function newPage(doc) {
  doc.addPage();
  return M;
}

function drawPageHeader(doc, form, logoBase64, pageNum) {
  // Barra superior navy
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 14, 'F');

  if (logoBase64 && pageNum === 1) {
    doc.addImage(logoBase64, 'JPEG', M, 1, 38, 12);
  }

  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('PLANILLA DE CÓMPUTO Y PRESUPUESTO', PAGE_W / 2, 9, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(`${form.codigo || ''} · Pág. ${pageNum}`, PAGE_W - M, 9, { align: 'right' });

  return 18;
}

function drawMetaBlock(doc, form, y) {
  const labelStyle = (label) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...GRAY2);
    return label;
  };

  const col1 = M, col2 = M + 38, col3 = PAGE_W / 2 + 2, col4 = PAGE_W / 2 + 42;
  const rowH = 6.5;

  const leftMeta = [
    ['COMITENTE:',    form.cliente_nombre || 'GCBA - MINISTERIO DE EDUCACIÓN GCBA'],
    ['LICITACIÓN:',   form.licitacion || '—'],
    ['ESCUELA:',      form.proyecto_nombre || '—'],
    ['OBRA:',         form.titulo || '—'],
    ['DIRECCIÓN:',    form.direccion_obra || '—'],
    ['SUPERVISOR:',   form.responsable || '—'],
  ];

  const rightMeta = [
    ['Nº PRESUPUESTO:',   form.codigo || '—'],
    ['EMPRESA:',          'MEJORES HOSPITALES S.A.'],
    ['FECHA:',            fmtDate(form.fecha_emision)],
    ['PLAZO:',            form.plazo || '—'],
    ['Coef. Pase:',       String(form.coef_pase ?? 1.6504)],
    ['Coef. Oferta:',     String(form.coef_oferta ?? 1.38)],
  ];

  if (form.preciario_fecha) rightMeta.push(['Preciario:',  fmtDate(form.preciario_fecha)]);

  // Fondo del bloque
  doc.setFillColor(...OFFWHT);
  doc.rect(M, y - 1, C, Math.max(leftMeta.length, rightMeta.length) * rowH + 4, 'F');
  doc.setDrawColor(...GRAY4); doc.setLineWidth(0.2);
  doc.rect(M, y - 1, C, Math.max(leftMeta.length, rightMeta.length) * rowH + 4);

  leftMeta.forEach(([label, val], i) => {
    const rowY = y + i * rowH + 4;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...GRAY3);
    doc.text(label, col1 + 1, rowY);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...GRAY1);
    doc.text(doc.splitTextToSize(val, col3 - col2 - 4)[0], col2, rowY);
  });

  rightMeta.forEach(([label, val], i) => {
    const rowY = y + i * rowH + 4;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...GRAY3);
    doc.text(label, col3, rowY);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...GRAY1);
    doc.text(val, col4, rowY);
  });

  // Divider vertical
  doc.setDrawColor(...GRAY4); doc.setLineWidth(0.2);
  doc.line(PAGE_W / 2, y - 1, PAGE_W / 2, y + Math.max(leftMeta.length, rightMeta.length) * rowH + 3);

  return y + Math.max(leftMeta.length, rightMeta.length) * rowH + 8;
}

// ── Cabecera de tabla de ítems ────────────────────────────────────────────────
// Columnas: ÍTEM | CÓD.PRECIARIO | DESCRIPCIÓN | UNID | CANT | PU MAT | PU MO | TOTAL PU | COEF PASE | TOTAL PASE | COEF OFERTA | PRECIO RESULT
const COLS = {
  item:   { x: M,    w: 10 },
  cod:    { x: M+10, w: 18 },
  desc:   { x: M+28, w: 70 },
  unid:   { x: M+98, w: 10 },
  cant:   { x: M+108,w: 12 },
  puMat:  { x: M+120,w: 18 },
  puMo:   { x: M+138,w: 18 },
  puTot:  { x: M+156,w: 18 },
  cPase:  { x: M+174,w: 13 },
  tPase:  { x: M+187,w: 20 },
  cOfer:  { x: M+207,w: 13 },
  result: { x: M+220,w: 67 },
};

function drawTableHeader(doc, y) {
  const h1 = 6, h2 = 6;

  // Primera fila headers agrupados
  doc.setFillColor(...NAVY);
  doc.rect(M, y, C, h1, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5); doc.setTextColor(...WHITE);
  doc.text('ÍTEM',           COLS.item.x + 1,  y + 4);
  doc.text('CÓD.PRECIARIO',  COLS.cod.x  + 1,  y + 4);
  doc.text('DESCRIPCIÓN',    COLS.desc.x + 1,  y + 4);
  doc.text('UNID.',          COLS.unid.x + 1,  y + 4);
  doc.text('CANT.',          COLS.cant.x + 1,  y + 4);
  // Grupo PRECIOS UNITARIOS
  const puGroupX = COLS.puMat.x;
  const puGroupW = COLS.puMat.w + COLS.puMo.w + COLS.puTot.w;
  doc.text('PRECIOS UNITARIOS', puGroupX + puGroupW / 2, y + 4, { align: 'center' });
  // COEF PASE
  doc.text('COEF. PASE', COLS.cPase.x + (COLS.cPase.w + COLS.tPase.w) / 2, y + 4, { align: 'center' });
  // COEF OFERTA
  doc.text('COEF. OFERTA', COLS.cOfer.x + (COLS.cOfer.w + COLS.result.w) / 2, y + 4, { align: 'center' });
  y += h1;

  // Segunda fila sub-headers
  doc.setFillColor(...NAVY2);
  doc.rect(M, y, C, h2, 'F');
  doc.setFontSize(5); doc.setTextColor(...WHITE);
  [
    ['', COLS.item],
    ['', COLS.cod],
    ['', COLS.desc],
    ['', COLS.unid],
    ['', COLS.cant],
    ['P.U.MAT.',  COLS.puMat],
    ['P.U.M.O.',  COLS.puMo],
    ['TOTAL',     COLS.puTot],
    ['COEF.',     COLS.cPase],
    ['TOTAL PASE', COLS.tPase],
    ['COEF.',     COLS.cOfer],
    ['PRECIO RESULT.', COLS.result],
  ].forEach(([label, col]) => {
    if (label) doc.text(label, col.x + col.w / 2, y + 4, { align: 'center' });
  });
  y += h2;

  return y;
}

function drawRubroHeader(doc, rubro, y) {
  const subtotal = (rubro.items || []).reduce((a, i) => a + (Number(i.total) || 0), 0);
  doc.setFillColor(...BLUE);
  doc.rect(M, y, C, 7, 'F');
  doc.setFillColor(...NAVY2);
  doc.rect(M, y, 2.5, 7, 'F');

  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...NAVY);
  doc.text((rubro.nombre || 'RUBRO').toUpperCase(), M + 5, y + 5);
  doc.setTextColor(...NAVY2);
  doc.text(fmtMoney(subtotal), PAGE_W - M - 1, y + 5, { align: 'right' });
  return y + 8;
}

function drawItemRow(doc, item, y, isAlt, coef_pase, coef_oferta) {
  if (isAlt) { doc.setFillColor(...OFFWHT); doc.rect(M, y, C, 6, 'F'); }

  const pu_mat    = Number(item.pu_mat) || Number(item.precio_unitario) || 0;
  const pu_mo     = Number(item.pu_mo) || 0;
  const total_pu  = pu_mat + pu_mo;
  const total_pase   = total_pu > 0 ? total_pu * coef_pase : Number(item.precio_unitario) || 0;
  const precio_result = total_pase > 0 ? total_pase * coef_oferta : Number(item.precio_unitario) || 0;

  // Fondo precio resultante (amarillo)
  doc.setFillColor(...YELLOW);
  doc.rect(COLS.result.x, y, COLS.result.w, 6, 'F');

  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...GRAY1);
  doc.text(String(item._num || ''), COLS.item.x + COLS.item.w / 2, y + 4, { align: 'center' });
  doc.text(item.codigo || '', COLS.cod.x + 1, y + 4);
  doc.text(doc.splitTextToSize(item.descripcion || '', 68)[0], COLS.desc.x + 1, y + 4);
  doc.text(item.unidad || '', COLS.unid.x + COLS.unid.w / 2, y + 4, { align: 'center' });

  doc.setTextColor(...GRAY2);
  const numRight = (val, col) => doc.text(
    new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(val || 0),
    col.x + col.w - 1, y + 4, { align: 'right' }
  );

  numRight(item.cantidad,  COLS.cant);
  numRight(pu_mat,         COLS.puMat);
  numRight(pu_mo,          COLS.puMo);
  numRight(total_pu,       COLS.puTot);
  numRight(coef_pase,      COLS.cPase);
  numRight(total_pase,     COLS.tPase);
  numRight(coef_oferta,    COLS.cOfer);

  doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY);
  numRight(precio_result,  COLS.result);

  // Línea separadora
  doc.setDrawColor(...GRAY4); doc.setLineWidth(0.1);
  doc.line(M, y + 6, PAGE_W - M, y + 6);

  return y + 6;
}

function drawRubroSubtotal(doc, rubro, y) {
  const sub = (rubro.items || []).reduce((a, i) => a + (Number(i.total) || 0), 0);
  doc.setFillColor(...GREEN);
  doc.rect(M, y, C, 5.5, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...NAVY2);
  doc.text(`Subtotal ${rubro.nombre || ''}`, M + 2, y + 4);
  doc.text(fmtMoney(sub), PAGE_W - M - 1, y + 4, { align: 'right' });
  return y + 7;
}

function drawResumen(doc, form, rubros, y) {
  const subtotal = rubros.reduce((a, r) => a + (r.items || []).reduce((b, i) => b + (Number(i.total) || 0), 0), 0);
  const gg  = subtotal * ((form.gastos_generales_pct || 0) / 100);
  const ben = (subtotal + gg) * ((form.beneficio_pct || 0) / 100);
  const base = subtotal + gg + ben;
  const iva  = base * ((form.iva_pct || 0) / 100);
  const total = base + iva;

  const bx = M + C - 95, bw = 95;

  doc.setDrawColor(...GRAY4); doc.setLineWidth(0.3);
  doc.line(M, y, PAGE_W - M, y); y += 5;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...NAVY);
  doc.text('RESUMEN FINANCIERO', bx, y); y += 4;

  const summaryRows = [
    [`Subtotal de obra`, subtotal],
    [`Gastos generales (${form.gastos_generales_pct || 0}%)`, gg],
    [`Beneficio / utilidad (${form.beneficio_pct || 0}%)`, ben],
    [`Base imponible`, base],
    [`IVA (${form.iva_pct || 0}%)`, iva],
  ];

  summaryRows.forEach(([label, val], i) => {
    if (i % 2 === 0) { doc.setFillColor(...OFFWHT); } else { doc.setFillColor(...WHITE); }
    doc.rect(bx, y, bw, 5.5, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...GRAY2);
    doc.text(label, bx + 2, y + 3.8);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...GRAY1);
    doc.text(fmtMoney(val), PAGE_W - M - 1, y + 3.8, { align: 'right' });
    y += 5.5;
  });

  y += 2;
  doc.setFillColor(...NAVY);
  doc.rect(bx, y, bw, 11, 'F');
  doc.setFillColor(...RED);
  doc.rect(bx, y, 3, 11, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...WHITE);
  doc.text('TOTAL PRESUPUESTO', bx + 5, y + 7.5);
  doc.setFontSize(9);
  doc.text(fmtMoney(total), PAGE_W - M - 1, y + 7.5, { align: 'right' });

  return y + 15;
}

function drawFooter(doc, form, pageNum, totalPages) {
  doc.setFillColor(...NAVY);
  doc.rect(0, PAGE_H - 8, PAGE_W, 8, 'F');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...WHITE);
  doc.text('MEJORES HOSPITALES S.A.  ·  en mantenimiento, obras y servicios', M, PAGE_H - 3);
  doc.text(`${form.codigo || 'PRESUPUESTO'}  ·  Pág. ${pageNum} / ${totalPages}`, PAGE_W - M, PAGE_H - 3, { align: 'right' });
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export async function generatePresupuestoPDF(form) {
  const logoBase64 = await loadLogo();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const rubros = form.rubros || [];
  const coef_pase   = form.coef_pase ?? 1.6504;
  const coef_oferta = form.coef_oferta ?? 1.38;

  let pageNum = 1;

  let y = drawPageHeader(doc, form, logoBase64, pageNum);
  y = drawMetaBlock(doc, form, y);

  const SAFE_BOTTOM = PAGE_H - 15;

  // Tabla
  y = drawTableHeader(doc, y);

  let globalItemNum = 1;

  for (const rubro of rubros) {
    // Si no hay espacio para el header del rubro + al menos 1 fila
    if (y + 20 > SAFE_BOTTOM) {
      drawFooter(doc, form, pageNum, '?');
      doc.addPage(); pageNum++;
      y = drawPageHeader(doc, form, logoBase64, pageNum);
      y = drawTableHeader(doc, y);
    }

    y = drawRubroHeader(doc, rubro, y);

    for (const item of (rubro.items || [])) {
      if (y + 6 > SAFE_BOTTOM) {
        drawFooter(doc, form, pageNum, '?');
        doc.addPage(); pageNum++;
        y = drawPageHeader(doc, form, logoBase64, pageNum);
        y = drawTableHeader(doc, y);
        y = drawRubroHeader(doc, rubro, y);
      }
      item._num = globalItemNum++;
      y = drawItemRow(doc, item, y, globalItemNum % 2 === 0, coef_pase, coef_oferta);
    }

    y = drawRubroSubtotal(doc, rubro, y);
    y += 3;
  }

  // Resumen
  if (y + 60 > SAFE_BOTTOM) {
    drawFooter(doc, form, pageNum, '?');
    doc.addPage(); pageNum++;
    y = drawPageHeader(doc, form, logoBase64, pageNum);
    y += 5;
  }

  y = drawResumen(doc, form, rubros, y);

  // Notas
  if (form.notas) {
    if (y + 20 > SAFE_BOTTOM) {
      drawFooter(doc, form, pageNum, '?');
      doc.addPage(); pageNum++;
      y = drawPageHeader(doc, form, logoBase64, pageNum);
      y += 5;
    }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...NAVY);
    doc.text('NOTAS Y CONDICIONES:', M, y); y += 4;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...GRAY2);
    const lines = doc.splitTextToSize(form.notas, C - 4);
    doc.text(lines, M + 2, y);
  }

  // Corregir el número de páginas en todos los footers
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(doc, form, p, totalPages);
  }

  doc.save(`PCP_${form.codigo || 'presupuesto'}_MEJORES.pdf`);
}