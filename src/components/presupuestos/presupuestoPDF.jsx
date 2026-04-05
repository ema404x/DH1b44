import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ── Brand colors Mejores (gris + rojo) ───────────────────────────────────────
const C = {
  dark:    [60,  60,  60],      // gris oscuro (texto principal, logo)
  navyMid: [60,  60,  60],      // alias → dark
  navy:    [60,  60,  60],      // alias → dark
  red:     [192, 57,  43],      // rojo Mejores
  blue:    [192, 57,  43],      // alias → red
  accent:  [90,  90,  90],      // gris medio
  blueLt:  [245, 235, 233],     // rojo muy claro
  gold:    [192, 57,  43],      // alias → red
  white:   [255, 255, 255],
  offWht:  [250, 250, 250],
  gray1:   [50,  50,  50],      // texto oscuro
  gray2:   [100, 100, 100],     // texto medio
  gray3:   [160, 160, 160],     // texto muted
  gray4:   [220, 220, 220],     // líneas/bordes
  rowAlt:  [247, 247, 247],     // fila alternada
};

const fmt = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (d) => {
  try { return d ? format(new Date(d), 'dd/MM/yyyy', { locale: es }) : '—'; } catch { return d || '—'; }
};

const rgb = (doc, arr) => doc.setTextColor(...arr);
const fill = (doc, arr) => doc.setFillColor(...arr);
const draw = (doc, arr) => doc.setDrawColor(...arr);
const bold = (doc) => doc.setFont('helvetica', 'bold');
const normal = (doc) => doc.setFont('helvetica', 'normal');

// ── Page geometry ─────────────────────────────────────────────────────────────
const PAGE_W = 210;
const MARGIN = 14;
const COL = PAGE_W - MARGIN * 2;

// ── HEADER COVER ──────────────────────────────────────────────────────────────
function drawHeader(doc, form) {
  // ── Fondo blanco con línea roja inferior
  fill(doc, C.white); doc.rect(0, 0, PAGE_W, 52, 'F');
  fill(doc, C.red); doc.rect(0, 49, PAGE_W, 3, 'F');

  // ── Logo vectorial Mejores (rectangulos gris+rojo)
  const lx = MARGIN, ly = 8;
  fill(doc, C.accent); doc.rect(lx, ly, 5, 10, 'F');          // bloque izquierdo gris
  fill(doc, C.red);    doc.rect(lx + 6, ly, 9, 4.5, 'F');     // bloque derecho arriba rojo
  fill(doc, C.accent); doc.rect(lx + 6, ly + 5.5, 9, 4.5, 'F'); // bloque derecho abajo gris
  fill(doc, C.red);    doc.circle(lx + 24, ly + 1, 1, 'F');   // punto rojo acento

  bold(doc); doc.setFontSize(20); rgb(doc, C.dark);
  doc.text('Mejores', lx + 17, ly + 9);
  normal(doc); doc.setFontSize(7); rgb(doc, C.gray3);
  doc.text('en mantenimiento, obras y servicios', lx + 17, ly + 13.5);
  doc.setFontSize(6.5);
  doc.text('info@mejores.com.ar  ·  +54 (11) 4000-0000', lx + 17, ly + 17.5);

  // Divider (vertical)
  draw(doc, C.gray4); doc.setLineWidth(0.3);
  doc.line(PAGE_W / 2, 6, PAGE_W / 2, 46);

  // ── Document info right side
  bold(doc); doc.setFontSize(14); rgb(doc, C.dark);
  doc.text('PRESUPUESTO DE OBRA', PAGE_W - MARGIN, 16, { align: 'right' });

  const estadoColor = { borrador: C.gray3, enviado: C.accent, aprobado: [60,140,60], rechazado: C.red, facturado: C.dark };
  const estadoLabels = { borrador:'BORRADOR', enviado:'ENVIADO', aprobado:'APROBADO', rechazado:'RECHAZADO', facturado:'FACTURADO' };
  const stColor = estadoColor[form.estado] || C.gray3;

  fill(doc, stColor);
  doc.roundedRect(PAGE_W - MARGIN - 36, 21, 36, 6.5, 1, 1, 'F');
  bold(doc); doc.setFontSize(7); rgb(doc, C.white);
  doc.text(estadoLabels[form.estado] || (form.estado || '').toUpperCase(), PAGE_W - MARGIN - 18, 25.5, { align: 'center' });

  normal(doc); doc.setFontSize(7.5); rgb(doc, C.gray2);
  doc.text(`Código:  ${form.codigo || '—'}`, PAGE_W - MARGIN, 31.5, { align: 'right' });
  doc.text(`Emisión: ${fmtDate(form.fecha_emision)}`, PAGE_W - MARGIN, 37, { align: 'right' });
  doc.text(`Validez: ${fmtDate(form.fecha_validez)}`, PAGE_W - MARGIN, 42, { align: 'right' });

  return 58;
}

// ── PROJECT INFO BLOCK ────────────────────────────────────────────────────────
function drawProjectInfo(doc, form, y) {
  // Section title
  bold(doc); doc.setFontSize(7.5); rgb(doc, C.blue);
  doc.text('DATOS DEL PROYECTO', MARGIN, y);
  draw(doc, C.blue); doc.setLineWidth(0.5);
  doc.line(MARGIN, y + 1.5, MARGIN + 52, y + 1.5);
  y += 5;

  // Two column grid
  const rows = [
    ['Cliente',       form.cliente_nombre  || '—', 'Proyecto',    form.proyecto_nombre || '—'],
    ['Dirección',     form.direccion_obra  || '—', 'Responsable', form.responsable     || '—'],
  ];

  rows.forEach(([l1, v1, l2, v2]) => {
    // Left cell
    fill(doc, C.offWht); doc.roundedRect(MARGIN, y - 1, COL / 2 - 2, 7, 0.8, 0.8, 'F');
    bold(doc); doc.setFontSize(6.5); rgb(doc, C.gray2); doc.text(l1, MARGIN + 2, y + 2);
    normal(doc); doc.setFontSize(7.5); rgb(doc, C.gray1);
    doc.text(doc.splitTextToSize(v1, COL / 2 - 10)[0], MARGIN + 2, y + 5.5);
    // Right cell
    const rx = MARGIN + COL / 2 + 1;
    fill(doc, C.offWht); doc.roundedRect(rx, y - 1, COL / 2 - 2, 7, 0.8, 0.8, 'F');
    bold(doc); doc.setFontSize(6.5); rgb(doc, C.gray2); doc.text(l2, rx + 2, y + 2);
    normal(doc); doc.setFontSize(7.5); rgb(doc, C.gray1);
    doc.text(doc.splitTextToSize(v2, COL / 2 - 10)[0], rx + 2, y + 5.5);
    y += 9.5;
  });

  return y + 3;
}

// ── TABLE HEADER ROW ──────────────────────────────────────────────────────────
function drawTableHeader(doc, y) {
  fill(doc, C.navyMid); doc.rect(MARGIN, y, COL, 6.5, 'F');
  bold(doc); doc.setFontSize(6.5); rgb(doc, C.white);
  doc.text('CÓD.',     MARGIN + 1,   y + 4.2);
  doc.text('DESCRIPCIÓN',            MARGIN + 15,  y + 4.2);
  doc.text('UD.',                    MARGIN + 107, y + 4.2);
  doc.text('CANT.',                  MARGIN + 118, y + 4.2, { align: 'right' });
  doc.text('P. UNIT.',               MARGIN + 148, y + 4.2, { align: 'right' });
  doc.text('TOTAL',   PAGE_W - MARGIN - 1, y + 4.2, { align: 'right' });
  return y + 7.5;
}

// ── ITEM ROW ──────────────────────────────────────────────────────────────────
function drawItemRow(doc, item, y, isAlt) {
  if (isAlt) { fill(doc, C.rowAlt); doc.rect(MARGIN, y, COL, 6, 'F'); }
  normal(doc); doc.setFontSize(7); rgb(doc, C.gray1);
  doc.text(String(item.codigo || ''), MARGIN + 1, y + 4);
  const desc = doc.splitTextToSize(item.descripcion || '', 88);
  doc.text(desc[0], MARGIN + 15, y + 4);
  doc.text(item.unidad || '', MARGIN + 107, y + 4);
  doc.text(String(item.cantidad ?? ''), MARGIN + 118, y + 4, { align: 'right' });
  normal(doc); rgb(doc, C.gray2);
  doc.text(fmt(item.precio_unitario), MARGIN + 148, y + 4, { align: 'right' });
  bold(doc); rgb(doc, C.gray1);
  doc.text(fmt(item.total), PAGE_W - MARGIN - 1, y + 4, { align: 'right' });
  return y + 6;
}

// ── RUBRO HEADER ──────────────────────────────────────────────────────────────
function drawRubroHeader(doc, rubro, y) {
  const sub = (rubro.items || []).reduce((a, i) => a + (i.total || 0), 0);
  fill(doc, C.blueLt); doc.rect(MARGIN, y, COL, 7.5, 'F');
  draw(doc, C.blue); doc.setLineWidth(0.3);
  doc.line(MARGIN, y, MARGIN, y + 7.5);
  fill(doc, C.blue); doc.rect(MARGIN, y, 2, 7.5, 'F');

  bold(doc); doc.setFontSize(8); rgb(doc, C.navyMid);
  doc.text((rubro.nombre || 'RUBRO').toUpperCase(), MARGIN + 4, y + 5);
  bold(doc); doc.setFontSize(7.5); rgb(doc, C.blue);
  doc.text(fmt(sub), PAGE_W - MARGIN - 1, y + 5, { align: 'right' });
  return y + 9;
}

// ── RUBRO SUBTOTAL ────────────────────────────────────────────────────────────
function drawRubroFooter(doc, rubro, y) {
  const sub = (rubro.items || []).reduce((a, i) => a + (i.total || 0), 0);
  draw(doc, C.gray4); doc.setLineWidth(0.2);
  doc.line(PAGE_W - MARGIN - 65, y, PAGE_W - MARGIN, y);
  normal(doc); doc.setFontSize(7); rgb(doc, C.gray2);
  doc.text(`Subtotal ${rubro.nombre || ''}`, PAGE_W - MARGIN - 65, y + 3.5);
  bold(doc); rgb(doc, C.navy);
  doc.text(fmt(sub), PAGE_W - MARGIN - 1, y + 3.5, { align: 'right' });
  return y + 7;
}

// ── FINANCIAL SUMMARY ─────────────────────────────────────────────────────────
function drawResumen(doc, form, rubros, y) {
  const subtotal = rubros.reduce((acc, r) => acc + (r.items || []).reduce((a, i) => a + (i.total || 0), 0), 0);
  const gg = subtotal * ((form.gastos_generales_pct || 15) / 100);
  const ben = (subtotal + gg) * ((form.beneficio_pct || 10) / 100);
  const baseImponible = subtotal + gg + ben;
  const iva = baseImponible * ((form.iva_pct || 21) / 100);
  const total = baseImponible + iva;

  const bx = MARGIN + 80;   // box left
  const bw = COL - 80;      // box width

  // Separator line
  draw(doc, C.gray4); doc.setLineWidth(0.4);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 6;

  // Title
  bold(doc); doc.setFontSize(8); rgb(doc, C.navyMid);
  doc.text('RESUMEN FINANCIERO', bx, y);
  y += 5;

  const rows = [
    [`Subtotal de obra`, subtotal],
    [`Gastos generales (${form.gastos_generales_pct || 15}%)`, gg],
    [`Beneficio / utilidad (${form.beneficio_pct || 10}%)`, ben],
    [`Base imponible`, baseImponible],
    [`IVA (${form.iva_pct || 21}%)`, iva],
  ];

  rows.forEach(([label, val], idx) => {
    if (idx === 3) {
      draw(doc, C.gray4); doc.setLineWidth(0.2);
      doc.line(bx, y - 1, PAGE_W - MARGIN, y - 1);
    }
    fill(doc, idx % 2 === 0 ? C.offWht : C.white);
    doc.rect(bx, y - 1, bw, 5.5, 'F');

    normal(doc); doc.setFontSize(7.5); rgb(doc, C.gray2);
    doc.text(label, bx + 2, y + 3);
    bold(doc); rgb(doc, C.gray1);
    doc.text(fmt(val), PAGE_W - MARGIN - 1, y + 3, { align: 'right' });
    y += 5.5;
  });

  // TOTAL bar
  y += 2;
  fill(doc, C.dark); doc.rect(bx, y, bw, 11, 'F');
  fill(doc, C.red); doc.rect(bx, y, 3, 11, 'F');
  bold(doc); doc.setFontSize(8.5); rgb(doc, C.white);
  doc.text('TOTAL', bx + 6, y + 7);
  doc.setFontSize(11); rgb(doc, C.white);
  doc.text(fmt(total), PAGE_W - MARGIN - 1, y + 7, { align: 'right' });

  return y + 16;
}

// ── NOTES ────────────────────────────────────────────────────────────────────
function drawNotas(doc, form, y) {
  if (!form.notas) return y;
  bold(doc); doc.setFontSize(7.5); rgb(doc, C.blue);
  doc.text('NOTAS Y CONDICIONES', MARGIN, y);
  draw(doc, C.blue); doc.setLineWidth(0.3);
  doc.line(MARGIN, y + 1.5, MARGIN + 56, y + 1.5);
  y += 5;

  fill(doc, C.offWht); doc.rect(MARGIN, y - 1, COL, 4, 'F'); // will resize below
  normal(doc); doc.setFontSize(7.5); rgb(doc, C.gray2);
  const lines = doc.splitTextToSize(form.notas, COL - 4);
  const boxH = lines.length * 4 + 3;
  fill(doc, C.offWht); doc.rect(MARGIN, y - 1, COL, boxH, 'F');
  draw(doc, C.gray4); doc.setLineWidth(0.2);
  doc.rect(MARGIN, y - 1, COL, boxH);
  doc.text(lines, MARGIN + 2, y + 3);
  return y + boxH + 4;
}

// ── SIGNATURE BLOCK ──────────────────────────────────────────────────────────
function drawSignatures(doc, form, y) {
  if (y > 255) { doc.addPage(); y = 20; }
  y += 8;
  const half = COL / 2 - 5;

  // Left: company sig
  draw(doc, C.gray4); doc.setLineWidth(0.3);
  doc.line(MARGIN, y + 15, MARGIN + half, y + 15);
  bold(doc); doc.setFontSize(7); rgb(doc, C.gray2);
  doc.text('MEJORES — Empresa', MARGIN + half / 2, y + 19, { align: 'center' });
  normal(doc); doc.setFontSize(6.5); rgb(doc, C.gray3);
  doc.text('Firma y sello', MARGIN + half / 2, y + 23, { align: 'center' });

  // Right: client sig
  const rx = MARGIN + half + 10;
  doc.line(rx, y + 15, rx + half, y + 15);
  bold(doc); doc.setFontSize(7); rgb(doc, C.gray2);
  doc.text(form.cliente_nombre || 'Cliente', rx + half / 2, y + 19, { align: 'center' });
  normal(doc); doc.setFontSize(6.5); rgb(doc, C.gray3);
  doc.text('Conformidad y firma', rx + half / 2, y + 23, { align: 'center' });
}

// ── GLOBAL FOOTER ────────────────────────────────────────────────────────────
function drawFooters(doc, form) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    fill(doc, C.red); doc.rect(0, 287, PAGE_W, 10, 'F');
    normal(doc); doc.setFontSize(6.5); rgb(doc, C.white);
    doc.text('MEJORES — en mantenimiento, obras y servicios  ·  info@mejores.com.ar', MARGIN, 293);
    doc.text(`${form.codigo || 'PRESUPUESTO'}  ·  Pág. ${i} / ${pages}`, PAGE_W - MARGIN, 293, { align: 'right' });
    if (i > 1) {
      fill(doc, C.red); doc.rect(0, 0, PAGE_W, 3, 'F');
    }
  }
}

// ── MAIN EXPORT ──────────────────────────────────────────────────────────────
export function generatePresupuestoPDF(form) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const rubros = form.rubros || [];

  let y = drawHeader(doc, form);
  y = drawProjectInfo(doc, form, y);

  // ── Items per rubro
  rubros.forEach((rubro) => {
    // Check space for rubro header + table header + at least 1 row
    if (y + 25 > 278) { doc.addPage(); y = 14; }

    y = drawRubroHeader(doc, rubro, y);
    y = drawTableHeader(doc, y);

    (rubro.items || []).forEach((item, idx) => {
      if (y + 7 > 278) {
        doc.addPage(); y = 14;
        y = drawRubroHeader(doc, rubro, y);
        y = drawTableHeader(doc, y);
      }
      y = drawItemRow(doc, item, y, idx % 2 === 1);
    });

    y = drawRubroFooter(doc, rubro, y);
    y += 2;
  });

  // Financial summary
  if (y + 60 > 278) { doc.addPage(); y = 14; }
  y = drawResumen(doc, form, rubros, y);

  // Notes & signatures
  y = drawNotas(doc, form, y);
  drawSignatures(doc, form, y);

  drawFooters(doc, form);

  doc.save(`${form.codigo || 'presupuesto'}_MEJORES.pdf`);
}