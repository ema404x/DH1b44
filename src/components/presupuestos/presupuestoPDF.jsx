import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ── Brand colors ─────────────────────────────────────────────────────────────
const C = {
  navy:    [10, 24, 52],        // #0A1834 - dark navy header
  navyMid: [18, 42, 90],        // mid navy
  blue:    [37, 99, 235],       // primary blue
  blueLt:  [219, 234, 254],     // light blue tint
  accent:  [16, 185, 129],      // emerald accent
  gold:    [245, 158, 11],      // gold/amber
  white:   [255, 255, 255],
  offWht:  [248, 250, 252],
  gray1:   [30,  40,  60],      // dark text
  gray2:   [80,  90, 110],      // medium text
  gray3:   [140, 150, 170],     // muted text
  gray4:   [220, 225, 235],     // lines/borders
  rowAlt:  [247, 249, 253],     // alternate row
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
  // Background band
  fill(doc, C.navy); doc.rect(0, 0, PAGE_W, 50, 'F');

  // Decorative stripe (accent)
  fill(doc, C.blue); doc.rect(0, 48, PAGE_W, 2, 'F');
  fill(doc, C.accent); doc.rect(0, 50, PAGE_W, 1, 'F');

  // ── Logo / brand left side
  // Circle logo mark
  fill(doc, C.blue);
  doc.circle(MARGIN + 7, 17, 7, 'F');
  fill(doc, C.accent);
  doc.circle(MARGIN + 7, 17, 4, 'F');
  fill(doc, C.white);
  doc.circle(MARGIN + 7, 17, 1.5, 'F');

  // Company name
  bold(doc); doc.setFontSize(18); rgb(doc, C.white);
  doc.text('MEJORES', MARGIN + 17, 16);
  normal(doc); doc.setFontSize(7); rgb(doc, C.gray3);
  doc.text('Mantenimiento y Construcción Escolar', MARGIN + 17, 21);
  doc.text('info@mejores.com.ar  ·  +54 (11) 4000-0000', MARGIN + 17, 26);

  // Divider (vertical)
  draw(doc, C.gray3); doc.setLineWidth(0.3);
  doc.line(PAGE_W / 2, 8, PAGE_W / 2, 43);

  // ── Document info right side
  bold(doc); doc.setFontSize(14); rgb(doc, C.white);
  doc.text('PRESUPUESTO DE OBRA', PAGE_W - MARGIN, 16, { align: 'right' });

  const estadoColor = { borrador: C.gray3, enviado: C.blue, aprobado: C.accent, rechazado: [220,38,38], facturado: C.gold };
  const estadoLabels = { borrador:'BORRADOR', enviado:'ENVIADO', aprobado:'APROBADO', rechazado:'RECHAZADO', facturado:'FACTURADO' };
  const stColor = estadoColor[form.estado] || C.gray3;

  fill(doc, stColor);
  doc.roundedRect(PAGE_W - MARGIN - 36, 21, 36, 6.5, 1, 1, 'F');
  bold(doc); doc.setFontSize(7); rgb(doc, C.white);
  doc.text(estadoLabels[form.estado] || (form.estado || '').toUpperCase(), PAGE_W - MARGIN - 18, 25.5, { align: 'center' });

  normal(doc); doc.setFontSize(7.5); rgb(doc, C.gray4);
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
  fill(doc, C.navy); doc.rect(bx, y, bw, 11, 'F');
  fill(doc, C.accent); doc.rect(bx, y, 3, 11, 'F');
  bold(doc); doc.setFontSize(8.5); rgb(doc, C.white);
  doc.text('TOTAL', bx + 6, y + 7);
  doc.setFontSize(11); rgb(doc, C.gold);
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
    fill(doc, C.navy); doc.rect(0, 287, PAGE_W, 10, 'F');
    normal(doc); doc.setFontSize(6.5); rgb(doc, C.gray3);
    doc.text('MEJORES — Mantenimiento y Construcción Escolar  ·  info@mejores.com.ar', MARGIN, 293);
    rgb(doc, C.gray3);
    doc.text(`${form.codigo || 'PRESUPUESTO'}  ·  Pág. ${i} / ${pages}`, PAGE_W - MARGIN, 293, { align: 'right' });
    // Top accent bar on continuation pages
    if (i > 1) {
      fill(doc, C.navy); doc.rect(0, 0, PAGE_W, 6, 'F');
      fill(doc, C.blue); doc.rect(0, 6, PAGE_W, 1, 'F');
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