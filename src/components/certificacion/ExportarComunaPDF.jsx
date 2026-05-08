import { jsPDF } from 'jspdf';

const ESTADO_LABEL = {
  listo_certificar: 'Listo para Certificar',
  faltan_actas:     'Faltan Cargar Actas',
  pendiente:        'Pendiente',
  observado:        'Observado',
};

const fmt = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

export function exportarComunaPDF(comuna, obras) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const margin = 14;
  const today = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

  // ── Header ──────────────────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Informe de Certificación — Comuna ${comuna}`, margin, 14);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generado: ${today}`, W - margin, 14, { align: 'right' });

  // ── Resumen ──────────────────────────────────────────────────────────────
  const montoTotal   = obras.reduce((s, o) => s + (o.monto_a_cobrar || 0), 0);
  const montoParcial = obras.filter(o => o.estado_cobro === 'listo_certificar').reduce((s, o) => s + (o.monto_a_cobrar || 0), 0);
  const cantListo    = obras.filter(o => o.estado_cobro === 'listo_certificar').length;

  let y = 32;
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  // Recuadro resumen
  doc.setFillColor(245, 247, 250);
  doc.setDrawColor(200, 210, 220);
  doc.roundedRect(margin, y, W - margin * 2, 16, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.text('Total obras:', margin + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(String(obras.length), margin + 24, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.text('Monto total:', margin + 40, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(fmt(montoTotal), margin + 62, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.text('Listo para Certificar:', margin + 110, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(22, 163, 74);
  doc.text(`${cantListo} obras — ${fmt(montoParcial)}`, margin + 143, y + 6);
  doc.setTextColor(30, 30, 30);

  y += 22;

  // ── Tabla ──────────────────────────────────────────────────────────────
  const cols = [
    { header: 'Establecimiento / Dirección', w: 52 },
    { header: 'Título SAP',                  w: 62 },
    { header: 'MTOM',                        w: 24 },
    { header: 'MEIN',                        w: 24 },
    { header: 'Inspector',                   w: 28 },
    { header: 'Plazo',                       w: 14 },
    { header: 'Monto Base',                  w: 30 },
    { header: 'A Cobrar',                    w: 30 },
    { header: 'Estado',                      w: 34 },
  ];

  const rowH = 8;
  const headerH = 9;

  // Cabecera tabla
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, y, W - margin * 2, headerH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');

  let x = margin + 1;
  cols.forEach(col => {
    doc.text(col.header, x + 1, y + 6);
    x += col.w;
  });
  y += headerH;

  // Filas
  obras.forEach((obra, idx) => {
    if (y + rowH > H - 14) {
      doc.addPage();
      y = 14;
      // re-dibujar cabecera
      doc.setFillColor(30, 41, 59);
      doc.rect(margin, y, W - margin * 2, headerH, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      let rx = margin + 1;
      cols.forEach(col => { doc.text(col.header, rx + 1, y + 6); rx += col.w; });
      y += headerH;
    }

    const isEven = idx % 2 === 0;
    doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
    doc.rect(margin, y, W - margin * 2, rowH, 'F');
    doc.setDrawColor(220, 225, 230);
    doc.line(margin, y + rowH, margin + (W - margin * 2), y + rowH);

    doc.setTextColor(40, 40, 40);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');

    const estab = (obra.establecimiento || obra.direccion || '—').substring(0, 28);
    const titulo = (obra.titulo || '—').substring(0, 38);
    const inspector = (obra.inspector || '—').substring(0, 16);
    const estadoLabel = ESTADO_LABEL[obra.estado_cobro] || obra.estado_cobro;

    const values = [
      estab, titulo,
      obra.oc_numero || '—',
      obra.ada_numero || '—',
      inspector,
      obra.plazo_dias ? `${obra.plazo_dias}d` : '—',
      fmt(obra.monto_contrato),
      fmt(obra.monto_a_cobrar),
      estadoLabel,
    ];

    x = margin + 1;
    values.forEach((val, vi) => {
      // Color estado
      if (vi === 8) {
        if (obra.estado_cobro === 'listo_certificar') doc.setTextColor(22, 163, 74);
        else if (obra.estado_cobro === 'faltan_actas') doc.setTextColor(161, 120, 0);
        else if (obra.estado_cobro === 'pendiente')    doc.setTextColor(200, 30, 30);
        else                                            doc.setTextColor(100, 100, 100);
      } else {
        doc.setTextColor(40, 40, 40);
      }
      doc.text(String(val), x + 1, y + 5.5);
      x += cols[vi].w;
    });

    // Motivo observación (si aplica)
    if (obra.estado_cobro === 'observado' && obra.motivo_observacion) {
      y += rowH;
      if (y + 5 > H - 14) { doc.addPage(); y = 14; }
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, y, W - margin * 2, 5.5, 'F');
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'italic');
      doc.text(`  ↳ Motivo observación: ${obra.motivo_observacion.substring(0, 120)}`, margin + 2, y + 4);
      doc.setFont('helvetica', 'normal');
      y += 5.5;
    } else {
      y += rowH;
    }
  });

  // ── Footer ──────────────────────────────────────────────────────────────
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFillColor(240, 242, 245);
    doc.rect(0, H - 8, W, 8, 'F');
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`DH1 Software — Certificación de Obras | Comuna ${comuna}`, margin, H - 3);
    doc.text(`Página ${i} de ${pages}`, W - margin, H - 3, { align: 'right' });
  }

  doc.save(`informe_certificacion_comuna_${comuna}_${new Date().toISOString().split('T')[0]}.pdf`);
}