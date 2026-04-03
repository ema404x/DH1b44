import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const fmtARS = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (d) => {
  try { return d ? format(new Date(d), 'dd/MM/yyyy', { locale: es }) : '-'; } catch { return d || '-'; }
};

// ── Helpers ──────────────────────────────────────────────────────────────
function addHeader(doc, title, subtitle) {
  const pageW = 210;
  const margin = 14;
  doc.setFillColor(15, 30, 55);
  doc.rect(0, 0, pageW, 36, 'F');

  doc.setTextColor(80, 160, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('MEJORES', margin, 15);

  doc.setTextColor(200, 210, 230);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Mantenimiento y Construcción Escolar', margin, 21);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageW - margin, 14, { align: 'right' });
  if (subtitle) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 190, 210);
    doc.text(subtitle, pageW - margin, 21, { align: 'right' });
  }
  doc.setFontSize(7.5);
  doc.setTextColor(150, 160, 180);
  doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}`, pageW - margin, 28, { align: 'right' });

  return 44;
}

function addFooter(doc) {
  const pageCount = doc.getNumberOfPages();
  const pageW = 210;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(240, 243, 250);
    doc.rect(0, 285, pageW, 12, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(130, 140, 160);
    doc.text('Mejores — Sistema ERP de Gestión Operacional', 14, 290);
    doc.text(`Pág. ${i} / ${pageCount}`, pageW - 14, 290, { align: 'right' });
  }
}

function sectionTitle(doc, text, y, margin = 14) {
  doc.setFillColor(235, 240, 250);
  doc.rect(margin, y - 1, 182, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 30, 55);
  doc.text(text, margin + 2, y + 4);
  return y + 9;
}

function kpiRow(doc, items, y, margin = 14) {
  const colW = 182 / items.length;
  items.forEach((item, i) => {
    const x = margin + i * colW;
    doc.setFillColor(248, 250, 255);
    doc.roundedRect(x, y, colW - 2, 14, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 30, 55);
    doc.text(String(item.value), x + colW / 2 - 1, y + 7, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 110, 130);
    doc.text(item.label, x + colW / 2 - 1, y + 12, { align: 'center' });
  });
  return y + 18;
}

// ── REPORTE DE PROYECTOS ─────────────────────────────────────────────────
export function exportProyectosPDF(projects) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const margin = 14;
  const pageW = 210;
  let y = addHeader(doc, 'REPORTE DE PROYECTOS', `Total: ${projects.length} proyectos`);

  const total = projects.length;
  const enProgreso = projects.filter(p => p.status === 'en_progreso').length;
  const completados = projects.filter(p => p.status === 'completado').length;
  const budgetTotal = projects.reduce((s, p) => s + (p.estimated_budget || 0), 0);

  y = kpiRow(doc, [
    { label: 'Total', value: total },
    { label: 'En Progreso', value: enProgreso },
    { label: 'Completados', value: completados },
    { label: 'Presupuesto Total', value: fmtARS(budgetTotal) },
  ], y);

  y += 4;
  y = sectionTitle(doc, 'DETALLE DE PROYECTOS', y);

  // Table header
  const cols = [
    { label: 'Nombre', x: margin, w: 55 },
    { label: 'Cliente', x: margin + 55, w: 35 },
    { label: 'Estado', x: margin + 90, w: 22 },
    { label: 'Avance', x: margin + 112, w: 18 },
    { label: 'Inicio', x: margin + 130, w: 22 },
    { label: 'Fin', x: margin + 152, w: 22 },
    { label: 'Presupuesto', x: margin + 174, w: 22 },
  ];

  const drawTableHeader = () => {
    doc.setFillColor(15, 30, 55);
    doc.rect(margin, y - 1, 182, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    cols.forEach(c => doc.text(c.label, c.x + 1, y + 3.5));
    y += 7;
  };

  drawTableHeader();

  projects.forEach((p, idx) => {
    if (y > 270) { doc.addPage(); y = addHeader(doc, 'REPORTE DE PROYECTOS', '(continuación)'); drawTableHeader(); }
    if (idx % 2 === 0) { doc.setFillColor(248, 250, 255); doc.rect(margin, y - 1, 182, 6.5, 'F'); }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(30, 30, 30);

    const name = doc.splitTextToSize(p.name || '', 52)[0];
    doc.text(name, margin + 1, y + 3.5);
    doc.text(doc.splitTextToSize(p.client_name || '-', 32)[0], margin + 56, y + 3.5);
    doc.text((p.status || '').replace('_', ' '), margin + 91, y + 3.5);
    doc.text(`${p.progress || 0}%`, margin + 113, y + 3.5);
    doc.text(fmtDate(p.start_date), margin + 131, y + 3.5);
    doc.text(fmtDate(p.end_date), margin + 153, y + 3.5);
    doc.setFont('helvetica', 'bold');
    doc.text(fmtARS(p.estimated_budget), margin + 175, y + 3.5);
    y += 6.5;
  });

  addFooter(doc);
  doc.save(`reporte_proyectos_${format(new Date(), 'yyyyMMdd')}.pdf`);
}

// ── REPORTE DE ÓRDENES DE TRABAJO ────────────────────────────────────────
export function exportOTsPDF(orders, dateFrom, dateTo) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 14;
  const pageW = 297;
  let y = addHeader(doc, 'REPORTE DE ÓRDENES DE TRABAJO', `Período: ${fmtDate(dateFrom)} — ${fmtDate(dateTo)}`);

  const completadas = orders.filter(o => o.status === 'completada').length;
  const urgentes = orders.filter(o => o.priority === 'urgente' && !['completada','cancelada'].includes(o.status)).length;
  const totalHoras = orders.reduce((s, o) => s + (o.actual_hours || 0), 0);

  y = kpiRow(doc, [
    { label: 'Total OTs', value: orders.length },
    { label: 'Completadas', value: completadas },
    { label: 'Urgentes activas', value: urgentes },
    { label: 'Horas reales', value: `${totalHoras}h` },
    { label: 'Tasa cumplimiento', value: orders.length > 0 ? `${Math.round((completadas / orders.length) * 100)}%` : '0%' },
  ], y);

  y += 4;
  y = sectionTitle(doc, 'DETALLE DE ÓRDENES', y);

  const cols = [
    { label: 'Código', x: margin, w: 20 },
    { label: 'Título', x: margin + 20, w: 55 },
    { label: 'Tipo', x: margin + 75, w: 28 },
    { label: 'Estado', x: margin + 103, w: 22 },
    { label: 'Prioridad', x: margin + 125, w: 20 },
    { label: 'Asignado', x: margin + 145, w: 30 },
    { label: 'Fecha', x: margin + 175, w: 22 },
    { label: 'H.Est.', x: margin + 197, w: 16 },
    { label: 'H.Real', x: margin + 213, w: 16 },
    { label: 'Activo', x: margin + 229, w: 28 },
    { label: 'Ubicación', x: margin + 257, w: 12 },
  ];

  const typeShort = {
    mantenimiento_preventivo: 'Preventivo', mantenimiento_correctivo: 'Correctivo',
    instalacion: 'Instalación', inspeccion: 'Inspección', reparacion: 'Reparación', emergencia: 'Emergencia'
  };

  const drawHeader = () => {
    doc.setFillColor(15, 30, 55);
    doc.rect(margin, y - 1, 269, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(255, 255, 255);
    cols.forEach(c => doc.text(c.label, c.x + 1, y + 3.5));
    y += 7;
  };

  drawHeader();

  orders.forEach((o, idx) => {
    if (y > 185) { doc.addPage(); y = addHeader(doc, 'REPORTE OTs', '(continuación)'); drawHeader(); }
    if (idx % 2 === 0) { doc.setFillColor(248, 250, 255); doc.rect(margin, y - 1, 269, 6, 'F'); }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(30, 30, 30);

    doc.text(o.code || '-', margin + 1, y + 3.5);
    doc.text(doc.splitTextToSize(o.title || '', 52)[0], margin + 21, y + 3.5);
    doc.text(typeShort[o.type] || o.type || '', margin + 76, y + 3.5);
    doc.text((o.status || '').replace('_', ' '), margin + 104, y + 3.5);
    doc.text(o.priority || '', margin + 126, y + 3.5);
    doc.text(doc.splitTextToSize(o.assigned_name || '-', 28)[0], margin + 146, y + 3.5);
    doc.text(fmtDate(o.scheduled_date), margin + 176, y + 3.5);
    doc.text(String(o.estimated_hours || '-'), margin + 198, y + 3.5);
    doc.setFont('helvetica', 'bold');
    doc.text(String(o.actual_hours || '-'), margin + 214, y + 3.5);
    doc.setFont('helvetica', 'normal');
    doc.text(doc.splitTextToSize(o.asset_name || '-', 26)[0], margin + 230, y + 3.5);
    y += 6;
  });

  addFooter(doc);
  doc.save(`reporte_ots_${format(new Date(), 'yyyyMMdd')}.pdf`);
}

// ── REPORTE KPIs ─────────────────────────────────────────────────────────
export function exportKPIsPDF({ orders, timeLogs, materials, assets, dateFrom, dateTo }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const margin = 14;
  let y = addHeader(doc, 'REPORTE DE KPIs OPERACIONALES', `Período: ${fmtDate(dateFrom)} — ${fmtDate(dateTo)}`);

  const completadas = orders.filter(o => o.status === 'completada').length;
  const eficiencia = orders.length > 0 ? Math.round((completadas / orders.length) * 100) : 0;
  const totalHoras = timeLogs.reduce((s, l) => s + (l.hours || 0), 0);
  const costoMat = orders.reduce((s, o) =>
    s + (o.materials_used || []).reduce((ms, m) => ms + (m.quantity * m.unit_cost || 0), 0), 0);
  const lowStock = materials.filter(m => m.stock <= m.min_stock && m.min_stock > 0).length;
  const mantVencidos = assets.filter(a => a.next_maintenance && new Date(a.next_maintenance) < new Date()).length;

  y = kpiRow(doc, [
    { label: 'OTs Totales', value: orders.length },
    { label: 'Completadas', value: completadas },
    { label: 'Cumplimiento', value: `${eficiencia}%` },
    { label: 'Horas totales', value: `${totalHoras}h` },
  ], y);
  y = kpiRow(doc, [
    { label: 'Costo Materiales', value: fmtARS(costoMat) },
    { label: 'Stock bajo', value: lowStock },
    { label: 'Mant. vencidos', value: mantVencidos },
    { label: 'Activos totales', value: assets.length },
  ], y + 2);

  y += 6;

  // OTs por tipo
  y = sectionTitle(doc, 'OTs POR TIPO', y);
  const byType = {};
  orders.forEach(o => { byType[o.type] = (byType[o.type] || 0) + 1; });
  const typeLabels = {
    mantenimiento_preventivo: 'Preventivo', mantenimiento_correctivo: 'Correctivo',
    instalacion: 'Instalación', inspeccion: 'Inspección', reparacion: 'Reparación', emergencia: 'Emergencia'
  };
  Object.entries(byType).forEach(([type, count]) => {
    const label = typeLabels[type] || type;
    const barW = orders.length > 0 ? Math.round((count / orders.length) * 120) : 0;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 30, 30);
    doc.text(label, margin, y + 4);
    doc.setFillColor(37, 99, 235);
    doc.roundedRect(margin + 45, y, barW, 5.5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text(`${count} (${Math.round((count / orders.length) * 100)}%)`, margin + 170, y + 4);
    y += 8;
  });

  y += 4;

  // Horas por técnico
  y = sectionTitle(doc, 'HORAS POR TÉCNICO (TOP 8)', y);
  const byTech = {};
  timeLogs.forEach(l => { byTech[l.employee_name] = (byTech[l.employee_name] || 0) + (l.hours || 0); });
  const maxH = Math.max(...Object.values(byTech), 1);
  Object.entries(byTech).sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([name, hours]) => {
    const barW = Math.round((hours / maxH) * 120);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 30, 30);
    doc.text(name || '—', margin, y + 4);
    doc.setFillColor(139, 92, 246);
    doc.roundedRect(margin + 45, y, barW, 5.5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text(`${hours}h`, margin + 170, y + 4);
    y += 8;
    if (y > 265) return;
  });

  // Stock bajo
  const lowMats = materials.filter(m => m.stock <= m.min_stock && m.min_stock > 0);
  if (lowMats.length > 0) {
    y += 4;
    y = sectionTitle(doc, 'MATERIALES CON STOCK BAJO', y);
    lowMats.slice(0, 10).forEach(m => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 30, 30);
      doc.text(m.name || '', margin, y + 4);
      doc.setTextColor(220, 38, 38);
      doc.setFont('helvetica', 'bold');
      doc.text(`${m.stock} / ${m.min_stock} (mínimo)`, margin + 120, y + 4);
      y += 7;
    });
  }

  addFooter(doc);
  doc.save(`reporte_kpis_${format(new Date(), 'yyyyMMdd')}.pdf`);
}