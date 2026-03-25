import jsPDF from 'jspdf';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

export function generatePresupuestoPDF(form) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 15;
  const col = pageW - margin * 2;
  let y = 15;

  const addPage = () => {
    doc.addPage();
    y = 20;
    addPageHeader();
  };

  const checkY = (needed = 10) => {
    if (y + needed > 275) addPage();
  };

  const addPageHeader = () => {
    doc.setFillColor(25, 35, 55);
    doc.rect(0, 0, pageW, 8, 'F');
  };

  // ---- HEADER ----
  doc.setFillColor(25, 35, 55);
  doc.rect(0, 0, pageW, 42, 'F');

  doc.setTextColor(255, 165, 50);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('DH1', margin, 18);

  doc.setFontSize(8);
  doc.setTextColor(160, 170, 190);
  doc.setFont('helvetica', 'normal');
  doc.text('Empresa de Construcción y Mantenimiento', margin, 24);
  doc.text('Sistema de Gestión Profesional', margin, 29);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('PRESUPUESTO DE OBRA', pageW - margin, 16, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 210, 220);
  doc.text(`Código: ${form.codigo || '-'}`, pageW - margin, 23, { align: 'right' });
  doc.text(`Emisión: ${form.fecha_emision || '-'}`, pageW - margin, 29, { align: 'right' });
  doc.text(`Válido hasta: ${form.fecha_validez || '-'}`, pageW - margin, 35, { align: 'right' });

  doc.setFillColor(240, 160, 40);
  const estadoLabels = { borrador:'BORRADOR', enviado:'ENVIADO', aprobado:'APROBADO', rechazado:'RECHAZADO', facturado:'FACTURADO' };
  doc.roundedRect(margin, 34, 32, 6, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text(estadoLabels[form.estado] || form.estado?.toUpperCase() || '', margin + 16, 38.5, { align: 'center' });

  y = 50;

  // ---- DATOS DEL PROYECTO ----
  doc.setTextColor(25, 35, 55);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('DATOS DEL PROYECTO', margin, y);
  y += 4;
  doc.setDrawColor(240, 160, 40);
  doc.setLineWidth(0.5);
  doc.line(margin, y, margin + 60, y);
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  const info = [
    ['Cliente:', form.cliente_nombre || '-'],
    ['Proyecto:', form.proyecto_nombre || '-'],
    ['Dirección de obra:', form.direccion_obra || '-'],
    ['Responsable:', form.responsable || '-'],
  ];
  info.forEach(([label, val]) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 80, 80);
    doc.text(label, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    doc.text(val, margin + 35, y);
    y += 5;
  });

  y += 4;

  // ---- RUBROS E ITEMS ----
  const rubros = form.rubros || [];

  rubros.forEach((rubro) => {
    checkY(16);
    const rubroSubtotal = rubro.items.reduce((a, i) => a + (i.total || 0), 0);

    // Rubro header
    doc.setFillColor(235, 238, 245);
    doc.rect(margin, y - 1, col, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(25, 35, 55);
    doc.text(rubro.nombre?.toUpperCase() || 'RUBRO', margin + 2, y + 4);
    doc.text(fmt(rubroSubtotal), pageW - margin - 2, y + 4, { align: 'right' });
    y += 9;

    // Column headers
    doc.setFillColor(245, 246, 250);
    doc.rect(margin, y - 1, col, 5.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 110, 130);
    doc.text('Cód.', margin + 1, y + 3);
    doc.text('Descripción', margin + 18, y + 3);
    doc.text('Ud.', margin + 110, y + 3);
    doc.text('Cant.', margin + 122, y + 3);
    doc.text('P.Unit.', margin + 140, y + 3, { align: 'right' });
    doc.text('Total', pageW - margin - 1, y + 3, { align: 'right' });
    y += 6;

    rubro.items.forEach((item, iIdx) => {
      checkY(7);
      if (iIdx % 2 === 1) {
        doc.setFillColor(250, 251, 253);
        doc.rect(margin, y - 1, col, 6, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(40, 40, 40);

      doc.text(item.codigo || '-', margin + 1, y + 3.5);
      const desc = doc.splitTextToSize(item.descripcion || '', 86);
      doc.text(desc[0], margin + 18, y + 3.5);
      doc.text(item.unidad || '', margin + 110, y + 3.5);
      doc.text(String(item.cantidad || 0), margin + 122, y + 3.5);
      doc.text(fmt(item.precio_unitario), margin + 152, y + 3.5, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text(fmt(item.total), pageW - margin - 1, y + 3.5, { align: 'right' });
      y += 6;
    });

    y += 3;
  });

  // ---- RESUMEN FINANCIERO ----
  checkY(50);
  y += 4;

  doc.setDrawColor(200, 205, 215);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(25, 35, 55);
  doc.text('RESUMEN FINANCIERO', margin, y);
  y += 6;

  const subtotal = rubros.reduce((acc, r) => acc + r.items.reduce((a, i) => a + (i.total || 0), 0), 0);
  const gg = subtotal * ((form.gastos_generales_pct || 15) / 100);
  const ben = (subtotal + gg) * ((form.beneficio_pct || 10) / 100);
  const baseImponible = subtotal + gg + ben;
  const iva = baseImponible * ((form.iva_pct || 21) / 100);
  const total = baseImponible + iva;

  const summaryX = pageW - margin - 90;
  const summaryW = 90;

  const resumenRows = [
    [`Subtotal de obra`, fmt(subtotal)],
    [`Gastos generales (${form.gastos_generales_pct || 15}%)`, fmt(gg)],
    [`Beneficio (${form.beneficio_pct || 10}%)`, fmt(ben)],
    [`Base imponible`, fmt(baseImponible)],
    [`IVA (${form.iva_pct || 21}%)`, fmt(iva)],
  ];

  resumenRows.forEach(([label, val]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(70, 70, 70);
    doc.text(label, summaryX, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(val, pageW - margin, y, { align: 'right' });
    y += 5.5;
  });

  y += 2;
  doc.setFillColor(25, 35, 55);
  doc.rect(summaryX - 3, y - 2, summaryW + 6, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('TOTAL', summaryX, y + 5);
  doc.setTextColor(255, 165, 50);
  doc.setFontSize(11);
  doc.text(fmt(total), pageW - margin, y + 5, { align: 'right' });
  y += 16;

  // ---- NOTAS ----
  if (form.notas) {
    checkY(20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(25, 35, 55);
    doc.text('NOTAS Y CONDICIONES', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(70, 70, 70);
    const notasLines = doc.splitTextToSize(form.notas, col);
    doc.text(notasLines, margin, y);
    y += notasLines.length * 4 + 5;
  }

  // ---- FOOTER ----
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(240, 242, 248);
    doc.rect(0, 285, pageW, 12, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120, 130, 150);
    doc.text('Documento generado por el Sistema de Gestión DH1 - Presupuesto basado en Precario Ministerial', margin, 290);
    doc.text(`Página ${i} de ${pageCount}`, pageW - margin, 290, { align: 'right' });
  }

  doc.save(`${form.codigo || 'presupuesto'}.pdf`);
}