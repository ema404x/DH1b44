// ─────────────────────────────────────────────────────────────────────────────
// MEJORES — Work Order (OT) PDF export
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
  dark:   [60, 60, 60],       // gris oscuro principal (logo text)
  mid:    [90, 90, 90],       // gris medio
  red:    [192, 57, 43],      // rojo Mejores
  redLt:  [250, 230, 228],    // rojo claro
  white:  [255, 255, 255],
  offWht: [250, 250, 250],
  gray1:  [50, 50, 50],       // texto oscuro
  gray2:  [100, 100, 100],    // texto medio
  gray3:  [160, 160, 160],    // texto muted
  gray4:  [220, 220, 220],    // líneas
  rowAlt: [247, 247, 247],    // fila alternada
  // mantener aliases para compatibilidad
  get navy() { return this.dark; },
  get blue() { return this.red; },
  get accent() { return this.mid; },
  get gold() { return this.red; },
};

const STATUS_COLORS = {
  pendiente:    [160, 160, 160],
  asignada:     [100, 100, 100],
  en_progreso:  [192, 57, 43],
  en_espera:    [180, 130, 0],
  completada:   [60, 140, 60],
  cancelada:    [150, 50, 50],
};

const STATUS_LABELS = {
  pendiente: 'PENDIENTE', asignada: 'ASIGNADA', en_progreso: 'EN PROGRESO',
  en_espera: 'EN ESPERA', completada: 'COMPLETADA', cancelada: 'CANCELADA',
};

const PRIORITY_COLORS = {
  baja: [160, 160, 160], media: [100, 100, 100], alta: [192, 100, 0], urgente: [192, 57, 43],
};

const TYPE_LABELS = {
  mantenimiento_preventivo: 'Preventivo', mantenimiento_correctivo: 'Correctivo',
  instalacion: 'Instalación', inspeccion: 'Inspección', reparacion: 'Reparación', emergencia: 'Emergencia',
};

const MEJORES_LOGO_URL = 'https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/b6844473f_mejores_cover.jpg';

async function loadLogoBase64(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

export async function exportWorkOrderPDF(order, timeLogs = []) {
  const logoBase64 = await loadLogoBase64(MEJORES_LOGO_URL);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, M = 14, COL = W - M * 2;
  let y = 0;

  // ── Header: fondo blanco con línea roja inferior
  doc.setFillColor(...C.white); doc.rect(0, 0, W, 52, 'F');
  doc.setFillColor(...C.red); doc.rect(0, 49, W, 3, 'F');
  doc.setFillColor(...C.gray4); doc.rect(0, 48.5, W, 0.5, 'F');

  // ── Logo Mejores (imagen real)
  if (logoBase64) {
    doc.addImage(logoBase64, 'JPEG', M, 5, 60, 22);
  } else {
    const lx = M, ly = 8;
    doc.setFillColor(...C.mid); doc.rect(lx, ly, 5, 10, 'F');
    doc.setFillColor(...C.red); doc.rect(lx + 6, ly, 9, 4.5, 'F');
    doc.setFillColor(...C.mid); doc.rect(lx + 6, ly + 5.5, 9, 4.5, 'F');
    doc.setFillColor(...C.red); doc.circle(lx + 24, ly + 1, 1, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...C.mid);
    doc.text('Mejores', lx + 17, ly + 9);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...C.gray3);
    doc.text('en mantenimiento, obras y servicios', lx + 17, ly + 13.5);
  }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...C.gray3);
  doc.text('info@mejores.com.ar  ·  +54 (11) 4000-0000', M, 30);

  // Línea divisoria vertical
  doc.setDrawColor(...C.gray4); doc.setLineWidth(0.3);
  doc.line(W / 2, 6, W / 2, 46);

  // Right: doc title + badges
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...C.dark);
  doc.text('ORDEN DE TRABAJO', W - M, 14, { align: 'right' });

  // Status badge
  const stColor = STATUS_COLORS[order.status] || C.gray3;
  doc.setFillColor(...stColor);
  doc.roundedRect(W - M - 36, 18, 36, 6.5, 1, 1, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...C.white);
  doc.text(STATUS_LABELS[order.status] || order.status?.toUpperCase() || '', W - M - 18, 22.5, { align: 'center' });

  // Priority badge
  const prColor = PRIORITY_COLORS[order.priority] || C.gray3;
  doc.setFillColor(...prColor);
  doc.roundedRect(W - M - 36, 27, 36, 6, 1, 1, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(...C.white);
  doc.text(`PRIORIDAD: ${(order.priority || '').toUpperCase()}`, W - M - 18, 31.2, { align: 'center' });

  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...C.gray2);
  doc.text(`Código: ${order.code || '—'}`, W - M, 37.5, { align: 'right' });
  doc.text(`Tipo: ${TYPE_LABELS[order.type] || order.type || '—'}`, W - M, 42, { align: 'right' });
  doc.text(`Impreso: ${fmtDate(new Date())}`, W - M, 46.5, { align: 'right' });

  y = 58;

  // ── Info grid
  const infoLabel = (label, value, x, iy, w) => {
    doc.setFillColor(...C.offWht); doc.roundedRect(x, iy, w, 8.5, 0.8, 0.8, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(...C.gray3);
    doc.text(label, x + 2, iy + 3);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.gray1);
    doc.text(doc.splitTextToSize(String(value || '—'), w - 4)[0], x + 2, iy + 7.2);
  };

  const half = (COL - 3) / 2;
  infoLabel('TÍTULO', order.title, M, y, COL);
  y += 10;
  infoLabel('ACTIVO / EQUIPO', order.asset_name, M, y, half);
  infoLabel('UBICACIÓN', order.location, M + half + 3, y, half);
  y += 10;
  infoLabel('ASIGNADO A', order.assigned_name, M, y, half);
  infoLabel('FECHA PROGRAMADA', fmtDate(order.scheduled_date), M + half + 3, y, half);
  y += 10;
  infoLabel('PROYECTO', order.project_name, M, y, half);
  infoLabel('FECHA COMPLETADA', fmtDate(order.completed_date), M + half + 3, y, half);
  y += 12;

  // Description
  if (order.description) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...C.red);
    doc.text('DESCRIPCIÓN', M, y);
    doc.setDrawColor(...C.red); doc.setLineWidth(0.4); doc.line(M, y + 1.5, M + 35, y + 1.5);
    y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.gray1);
    const descLines = doc.splitTextToSize(order.description, COL - 4);
    doc.setFillColor(...C.offWht); doc.rect(M, y - 1, COL, descLines.length * 4 + 3, 'F');
    doc.text(descLines, M + 2, y + 3);
    y += descLines.length * 4 + 5;
  }

  // ── Checklist
  const checklist = order.checklist || [];
  if (checklist.length > 0) {
    if (y + 15 > 275) { doc.addPage(); y = 14; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...C.red);
    doc.text('CHECKLIST DE TAREAS', M, y);
    doc.setDrawColor(...C.red); doc.setLineWidth(0.4); doc.line(M, y + 1.5, M + 50, y + 1.5);
    y += 5;

    const done = checklist.filter(t => t.completed).length;
    const pct = checklist.length > 0 ? Math.round((done / checklist.length) * 100) : 0;

    // Progress bar
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...C.gray2);
    doc.text(`${done}/${checklist.length} completadas (${pct}%)`, M, y + 3);
    doc.setFillColor(...C.gray4); doc.rect(M, y + 4, COL, 2.5, 'F');
    const barColor = pct === 100 ? [60, 140, 60] : C.red;
    doc.setFillColor(...barColor); doc.rect(M, y + 4, COL * pct / 100, 2.5, 'F');
    y += 10;

    checklist.forEach(task => {
      if (y + 7 > 275) { doc.addPage(); y = 14; }
      const isDone = task.completed;
      doc.setFillColor(...(isDone ? [240, 248, 240] : C.offWht));
      doc.rect(M, y, COL, 6.5, 'F');
      // Checkbox visual
      doc.setDrawColor(...(isDone ? [60, 140, 60] : C.gray3));
      doc.setLineWidth(0.5); doc.rect(M + 2, y + 1.5, 3.5, 3.5);
      if (isDone) {
        doc.setFillColor(60, 140, 60); doc.rect(M + 2, y + 1.5, 3.5, 3.5, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(5); doc.setTextColor(...C.white);
        doc.text('✓', M + 2.5, y + 4.3);
      }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
      doc.setTextColor(isDone ? C.gray3[0] : C.gray1[0], isDone ? C.gray3[1] : C.gray1[1], isDone ? C.gray3[2] : C.gray1[2]);
      doc.text(doc.splitTextToSize(task.task, COL - 10)[0], M + 8, y + 4.5);
      y += 7;
    });
    y += 4;
  }

  // ── Materials used
  const materials = order.materials_used || [];
  if (materials.length > 0) {
    if (y + 20 > 275) { doc.addPage(); y = 14; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...C.red);
    doc.text('MATERIALES UTILIZADOS', M, y);
    doc.setDrawColor(...C.red); doc.setLineWidth(0.4); doc.line(M, y + 1.5, M + 55, y + 1.5);
    y += 5;

    doc.setFillColor(...C.dark); doc.rect(M, y, COL, 6, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...C.white);
    doc.text('MATERIAL', M + 2, y + 4); doc.text('CANT.', M + 110, y + 4, { align: 'right' });
    doc.text('COSTO UNIT.', M + 150, y + 4, { align: 'right' }); doc.text('SUBTOTAL', W - M - 1, y + 4, { align: 'right' });
    y += 7;
    let matTotal = 0;
    materials.forEach((m, i) => {
      if (y + 6 > 275) { doc.addPage(); y = 14; }
      const sub = (m.quantity || 0) * (m.unit_cost || 0);
      matTotal += sub;
      if (i % 2 === 1) { doc.setFillColor(...C.rowAlt); doc.rect(M, y, COL, 5.5, 'F'); }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...C.gray1);
      doc.text(doc.splitTextToSize(m.material_name || '', 90)[0], M + 2, y + 3.8);
      doc.text(String(m.quantity || ''), M + 110, y + 3.8, { align: 'right' });
      doc.setTextColor(...C.gray2); doc.text(fmt(m.unit_cost), M + 150, y + 3.8, { align: 'right' });
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.gray1); doc.text(fmt(sub), W - M - 1, y + 3.8, { align: 'right' });
      y += 5.5;
    });
    y += 2;
    doc.setFillColor(...C.dark); doc.rect(W - M - 55, y, 55, 7.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...C.white);
    doc.text('TOTAL MATERIALES', W - M - 53, y + 4.8);
    doc.setTextColor(...C.red); doc.text(fmt(matTotal), W - M - 1, y + 4.8, { align: 'right' });
    y += 12;
  }

  // ── Time logs
  if (timeLogs.length > 0) {
    if (y + 20 > 275) { doc.addPage(); y = 14; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...C.red);
    doc.text('REGISTRO DE HORAS', M, y);
    doc.setDrawColor(...C.red); doc.setLineWidth(0.4); doc.line(M, y + 1.5, M + 48, y + 1.5);
    y += 5;

    doc.setFillColor(...C.dark); doc.rect(M, y, COL, 6, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...C.white);
    doc.text('TÉCNICO', M + 2, y + 4); doc.text('FECHA', M + 80, y + 4, { align: 'right' });
    doc.text('TIPO', M + 130, y + 4, { align: 'right' }); doc.text('HORAS', W - M - 1, y + 4, { align: 'right' });
    y += 7;
    let totalHrs = 0;
    timeLogs.forEach((tl, i) => {
      if (y + 6 > 275) { doc.addPage(); y = 14; }
      totalHrs += tl.hours || 0;
      if (i % 2 === 1) { doc.setFillColor(...C.rowAlt); doc.rect(M, y, COL, 5.5, 'F'); }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...C.gray1);
      doc.text(tl.employee_name || '—', M + 2, y + 3.8);
      doc.text(fmtDate(tl.date), M + 80, y + 3.8, { align: 'right' });
      doc.setTextColor(...C.gray2); doc.text(tl.type || '—', M + 130, y + 3.8, { align: 'right' });
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.gray1); doc.text(`${tl.hours}h`, W - M - 1, y + 3.8, { align: 'right' });
      y += 5.5;
    });
    y += 2;
    doc.setFillColor(...C.dark); doc.rect(W - M - 40, y, 40, 7.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...C.white);
    doc.text('TOTAL HORAS', W - M - 38, y + 4.8);
    doc.setTextColor(...C.red); doc.text(`${totalHrs}h`, W - M - 1, y + 4.8, { align: 'right' });
    y += 12;
  }

  // ── Hours summary
  if (order.estimated_hours || order.actual_hours) {
    if (y + 20 > 275) { doc.addPage(); y = 14; }
    const bx = M + 90, bw = COL - 90;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...C.dark);
    doc.text('RESUMEN DE HORAS', bx, y);
    y += 5;
    [[`Estimadas`, order.estimated_hours], [`Reales`, order.actual_hours]].forEach(([label, val], i) => {
      doc.setFillColor(...(i % 2 === 0 ? C.offWht : C.white));
      doc.rect(bx, y - 1, bw, 5.5, 'F');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.gray2);
      doc.text(label, bx + 2, y + 3);
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.gray1);
      doc.text(`${val || 0}h`, W - M - 1, y + 3, { align: 'right' });
      y += 5.5;
    });
    y += 6;
  }

  // ── Notes
  if (order.notes) {
    if (y + 20 > 275) { doc.addPage(); y = 14; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...C.red);
    doc.text('NOTAS', M, y);
    y += 4;
    const lines = doc.splitTextToSize(order.notes, COL - 4);
    doc.setFillColor(...C.offWht); doc.rect(M, y - 1, COL, lines.length * 4 + 3, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.gray2);
    doc.text(lines, M + 2, y + 3);
    y += lines.length * 4 + 8;
  }

  // ── Signature block
  if (y + 30 > 275) { doc.addPage(); y = 14; }
  y = Math.max(y, 235);
  doc.setDrawColor(...C.gray4); doc.setLineWidth(0.4);
  const sigW = (COL - 10) / 2;
  doc.line(M, y + 15, M + sigW, y + 15);
  doc.line(M + sigW + 10, y + 15, M + COL, y + 15);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...C.gray3);
  doc.text('Firma del Técnico', M + sigW / 2, y + 19, { align: 'center' });
  doc.text(order.assigned_name || 'Responsable', M + sigW / 2, y + 23, { align: 'center' });
  doc.text('Firma del Supervisor', M + sigW + 10 + sigW / 2, y + 19, { align: 'center' });
  doc.text('Fecha: _______________', M + sigW + 10 + sigW / 2, y + 23, { align: 'center' });

  // ── Footer
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFillColor(...C.red); doc.rect(0, 287, W, 10, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...C.white);
    doc.text('MEJORES — en mantenimiento, obras y servicios  ·  info@mejores.com.ar', M, 293);
    doc.text(`${order.code || 'OT'}  ·  Pág. ${i} / ${pages}`, W - M, 293, { align: 'right' });
    if (i > 1) {
      doc.setFillColor(...C.red); doc.rect(0, 0, W, 3, 'F');
    }
  }

  doc.save(`OT_${order.code || order.id}_MEJORES.pdf`);
}