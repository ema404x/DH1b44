import { jsPDF } from 'jspdf';

const ESTADO_LABEL = {
  listo_certificar: 'Listo para Certificar',
  faltan_actas:     'Faltan Cargar Actas',
  pendiente:        'Pendiente',
  observado:        'Observado',
};

const fmt = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

function drawTableHeader(doc, cols, margin, y, headerH) {
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, y, cols.reduce((s, c) => s + c.w, 0), headerH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  let x = margin;
  cols.forEach(col => {
    doc.text(col.header, x + 2, y + headerH - 2.5);
    x += col.w;
  });
}

export function exportarComunaPDF(comuna, obras) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();   // 297mm
  const pageH = doc.internal.pageSize.getHeight();  // 210mm
  const margin = 10;
  const usableW = pageW - margin * 2;               // 277mm
  const today = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

  // Columnas — suma exacta = usableW (277mm)
  const cols = [
    { header: 'Establecimiento',  w: 46 },
    { header: 'Título SAP',       w: 55 },
    { header: 'N° MTOM',          w: 25 },
    { header: 'N° MEIN',          w: 25 },
    { header: 'Inspector',        w: 28 },
    { header: 'Plazo',            w: 13 },
    { header: '%',                w: 12 },
    { header: 'Monto Base',       w: 33 },
    { header: 'A Cobrar',         w: 33 },
    { header: 'Estado',           w: 27 },
  ]; // total: 297

  const headerH = 8;
  const rowH    = 7;
  const footerH = 10;
  const bodyBottom = pageH - footerH;

  // ── Header página 1 ──────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(`Informe de Certificación — Comuna ${comuna}`, margin, 13);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generado: ${today}`, pageW - margin, 13, { align: 'right' });

  // ── Recuadro resumen ──────────────────────────────────────────────────
  const montoTotal   = obras.reduce((s, o) => s + (o.monto_a_cobrar || 0), 0);
  const montoParcial = obras.filter(o => o.estado_cobro === 'listo_certificar').reduce((s, o) => s + (o.monto_a_cobrar || 0), 0);
  const cantListo    = obras.filter(o => o.estado_cobro === 'listo_certificar').length;

  let y = 24;
  doc.setFillColor(245, 247, 250);
  doc.setDrawColor(200, 210, 220);
  doc.roundedRect(margin, y, usableW, 14, 2, 2, 'FD');

  const col1 = margin + 4;
  const col2 = margin + 80;
  const col3 = margin + 175;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);
  doc.text('Total obras:', col1, y + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.text(String(obras.length), col1 + 22, y + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.text('Monto total a cobrar:', col2, y + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.text(fmt(montoTotal), col2 + 44, y + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.text('Listo para Certificar:', col3, y + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(22, 163, 74);
  doc.text(`${cantListo} obras  /  ${fmt(montoParcial)}`, col3 + 44, y + 5.5);
  doc.setTextColor(60, 60, 60);

  // segunda línea conteo estados
  const faltanActas = obras.filter(o => o.estado_cobro === 'faltan_actas').length;
  const pendientes  = obras.filter(o => o.estado_cobro === 'pendiente').length;
  const observados  = obras.filter(o => o.estado_cobro === 'observado').length;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Faltan Actas: ${faltanActas}   |   Pendiente: ${pendientes}   |   Observado: ${observados}`,
    col1, y + 11
  );
  doc.setTextColor(60, 60, 60);

  y += 18;

  // ── Tabla ──────────────────────────────────────────────────────────────
  drawTableHeader(doc, cols, margin, y, headerH);
  y += headerH;

  obras.forEach((obra, idx) => {
    // ¿Necesita nueva página?
    if (y + rowH > bodyBottom) {
      doc.addPage();
      y = margin;
      drawTableHeader(doc, cols, margin, y, headerH);
      y += headerH;
    }

    const isEven = idx % 2 === 0;
    doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
    doc.rect(margin, y, usableW, rowH, 'F');
    doc.setDrawColor(220, 225, 230);
    doc.line(margin, y + rowH, margin + usableW, y + rowH);

    doc.setFontSize(6.8);
    doc.setFont('helvetica', 'normal');

    const estab    = truncate(obra.establecimiento || obra.direccion || '—', 30);
    const titulo   = truncate(obra.titulo || '—', 38);
    const inspector = truncate(obra.inspector || '—', 18);
    const estadoLabel = ESTADO_LABEL[obra.estado_cobro] || obra.estado_cobro;
    const tramoLabel = obra.tramo_certificacion === 'primer_50'
      ? '1° 50%'
      : obra.tramo_certificacion === 'segundo_50'
        ? '2° 50%'
        : '';

    // Calcular color del % de avance
    const pct = obra.porcentaje_avance || 0;
    const colorAvance = obra.color_avance || 'auto';
    const COLOR_MAP = {
      verde:    [22,  163, 74],
      amarillo: [202, 160,  0],
      naranja:  [249, 115,  22],
      rojo:     [200,  30,  30],
      azul:     [37,   99, 235],
      gris:     [120, 120, 120],
    };
    let pctColor;
    if (colorAvance !== 'auto' && COLOR_MAP[colorAvance]) {
      pctColor = COLOR_MAP[colorAvance];
    } else {
      // Auto: amarillo <= 50%, naranja > 50%, verde 100%
      if (pct >= 100)     pctColor = COLOR_MAP.verde;
      else if (pct > 50)  pctColor = COLOR_MAP.naranja;
      else                pctColor = COLOR_MAP.amarillo;
    }

    const values = [
      estab,
      titulo,
      obra.oc_numero  || '—',
      obra.ada_numero || '—',
      inspector,
      obra.plazo_dias ? `${obra.plazo_dias}d` : '—',
      obra.porcentaje_avance > 0 ? `${obra.porcentaje_avance}%` : '—',
      fmt(obra.monto_contrato),
      fmt(obra.monto_a_cobrar),
      tramoLabel ? `${estadoLabel} (${tramoLabel})` : estadoLabel,
    ];

    let x = margin;
    values.forEach((val, vi) => {
      if (vi === 6) {
        // Color del % de avance (manual o automático)
        doc.setTextColor(...pctColor);
        doc.setFont('helvetica', 'bold');
      } else if (vi === 9) {
        doc.setFont('helvetica', 'normal');
        if      (obra.tramo_certificacion === 'primer_50')  doc.setTextColor(180, 140, 0);
        else if (obra.tramo_certificacion === 'segundo_50') doc.setTextColor(200, 90, 0);
        else if (obra.estado_cobro === 'listo_certificar')  doc.setTextColor(22, 163, 74);
        else if (obra.estado_cobro === 'faltan_actas')      doc.setTextColor(161, 120, 0);
        else if (obra.estado_cobro === 'pendiente')         doc.setTextColor(200, 30, 30);
        else                                                doc.setTextColor(100, 100, 100);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(40, 40, 40);
      }
      // Alinear montos a la derecha
      if (vi === 7 || vi === 8) {
        doc.text(String(val), x + cols[vi].w - 2, y + rowH - 2, { align: 'right' });
      } else {
        doc.text(String(val), x + 2, y + rowH - 2);
      }
      x += cols[vi].w;
    });

    y += rowH;

    // Fila motivo observación
    if (obra.estado_cobro === 'observado' && obra.motivo_observacion) {
      if (y + 6 > bodyBottom) {
        doc.addPage();
        y = margin;
        drawTableHeader(doc, cols, margin, y, headerH);
        y += headerH;
      }
      doc.setFillColor(240, 240, 245);
      doc.rect(margin, y, usableW, 6, 'F');
      doc.setTextColor(100, 100, 110);
      doc.setFontSize(6.2);
      doc.setFont('helvetica', 'italic');
      const motivo = truncate(obra.motivo_observacion, 140);
      doc.text(`↳ Motivo: ${motivo}`, margin + 3, y + 4.2);
      doc.setFont('helvetica', 'normal');
      y += 6;
    }
  });

  // ── Footers ──────────────────────────────────────────────────────────────
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    addFooter(doc, pageW, pageH, margin, comuna, i, pages);
  }

  doc.save(`informe_certificacion_comuna_${comuna}_${new Date().toISOString().split('T')[0]}.pdf`);
}

function truncate(str, max) {
  if (!str) return '—';
  return str.length > max ? str.substring(0, max) + '…' : str;
}

function addFooter(doc, pageW, pageH, margin, comuna, current, total) {
  doc.setFillColor(235, 238, 242);
  doc.rect(0, pageH - 8, pageW, 8, 'F');
  doc.setTextColor(130, 130, 130);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`DH1 Software — Certificación de Obras | Comuna ${comuna}`, margin, pageH - 3);
  if (current && total) {
    doc.text(`Página ${current} de ${total}`, pageW - margin, pageH - 3, { align: 'right' });
  }
}