import { jsPDF } from 'jspdf';

const ESTADO_LABEL = {
  listo_certificar: 'Listo p/ Certificar',
  faltan_actas:     'Faltan Actas',
  pendiente:        'Pendiente',
  observado:        'Observado',
};

const ESTADO_COLOR = {
  listo_certificar: [22, 163, 74],
  faltan_actas:     [180, 140, 0],
  pendiente:        [200, 30, 30],
  observado:        [100, 100, 110],
};

const TRAMO_COLOR = {
  primer_50:  [180, 140, 0],
  segundo_50: [210, 100, 10],
};

const COLOR_MAP = {
  verde:    [22,  163,  74],
  amarillo: [202, 160,   0],
  naranja:  [249, 115,  22],
  rojo:     [200,  30,  30],
  azul:     [ 37,  99, 235],
  gris:     [120, 120, 120],
};

const fmt = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

function truncate(str, max) {
  if (!str) return '—';
  return str.length > max ? str.substring(0, max) + '…' : str;
}

function getPctColor(obra) {
  const pct = obra.porcentaje_avance || 0;
  const c = obra.color_avance || 'auto';
  if (c !== 'auto' && COLOR_MAP[c]) return COLOR_MAP[c];
  if (pct >= 100) return COLOR_MAP.verde;
  if (pct > 50)   return COLOR_MAP.naranja;
  return COLOR_MAP.amarillo;
}

// ── Header de tabla ────────────────────────────────────────────────────────
function drawTableHeader(doc, cols, margin, y, headerH) {
  const totalW = cols.reduce((s, c) => s + c.w, 0);
  // Fondo header
  doc.setFillColor(22, 36, 60);
  doc.rect(margin, y, totalW, headerH, 'F');
  // Línea inferior accent
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(0.5);
  doc.line(margin, y + headerH, margin + totalW, y + headerH);
  doc.setLineWidth(0.1);

  doc.setTextColor(200, 215, 240);
  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'bold');
  let x = margin;
  cols.forEach((col, i) => {
    const isNum = col.align === 'right';
    doc.text(col.header, isNum ? x + col.w - 2 : x + 2.5, y + headerH - 2.5, { align: isNum ? 'right' : 'left' });
    // separador vertical
    if (i < cols.length - 1) {
      doc.setDrawColor(50, 70, 110);
      doc.line(x + col.w, y + 1.5, x + col.w, y + headerH - 1.5);
    }
    x += col.w;
  });
}

// ── Tarjeta KPI ────────────────────────────────────────────────────────────
function drawKpiCard(doc, x, y, w, h, label, value, subvalue, color) {
  const [r, g, b] = color;
  // fondo
  doc.setFillColor(r, g, b, 0.08);
  doc.roundedRect(x, y, w, h, 2, 2, 'F');
  // borde izquierdo accent
  doc.setFillColor(r, g, b);
  doc.rect(x, y, 2.5, h, 'F');
  // label
  doc.setTextColor(100, 110, 125);
  doc.setFontSize(6.2);
  doc.setFont('helvetica', 'normal');
  doc.text(label, x + 5, y + 4.5);
  // value
  doc.setTextColor(r, g, b);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(String(value), x + 5, y + 10.5);
  // subvalue
  if (subvalue) {
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 130, 140);
    doc.text(subvalue, x + 5, y + 14.5);
  }
}

// ── Exportar PDF ────────────────────────────────────────────────────────────
export function exportarComunaPDF(comuna, obras) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW  = doc.internal.pageSize.getWidth();  // 297mm
  const pageH  = doc.internal.pageSize.getHeight(); // 210mm
  const margin = 10;
  const usableW = pageW - margin * 2; // 277mm
  const today = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

  // KPIs
  const montoTotal   = obras.reduce((s, o) => s + (o.monto_a_cobrar || 0), 0);
  const montoParcial = obras.filter(o => o.estado_cobro === 'listo_certificar').reduce((s, o) => s + (o.monto_a_cobrar || 0), 0);
  const cantListo    = obras.filter(o => o.estado_cobro === 'listo_certificar').length;
  const faltanActas  = obras.filter(o => o.estado_cobro === 'faltan_actas').length;
  const pendientes   = obras.filter(o => o.estado_cobro === 'pendiente').length;
  const observados   = obras.filter(o => o.estado_cobro === 'observado').length;

  // Columnas — suma exacta = 277mm
  const cols = [
    { header: 'Establecimiento', w: 44 },
    { header: 'Título SAP',      w: 50 },
    { header: 'N° MTOM',         w: 24 },
    { header: 'N° MEIN',         w: 24 },
    { header: 'Inspector',       w: 26 },
    { header: 'Plazo',           w: 12 },
    { header: '%',               w: 11, align: 'right' },
    { header: 'Monto Base',      w: 32, align: 'right' },
    { header: 'A Cobrar',        w: 32, align: 'right' },
    { header: 'Estado',          w: 22 },
  ]; // total: 277mm

  const headerH   = 8;
  const rowH      = 7;
  const footerH   = 10;
  const bodyBottom = pageH - footerH;

  // ── HEADER ────────────────────────────────────────────────────────────────
  // Fondo oscuro
  doc.setFillColor(10, 20, 40);
  doc.rect(0, 0, pageW, 22, 'F');
  // Franja accent azul abajo del header
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 22, pageW, 1.5, 'F');

  // Logo / Título
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Certificación de Obras — Comuna ${comuna}`, margin, 14);

  // Subtítulo derecha
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150, 175, 210);
  doc.text(`Generado: ${today}`, pageW - margin, 10, { align: 'right' });
  doc.setTextColor(100, 130, 170);
  doc.text('MEJORES HOSPITALES S.A.', pageW - margin, 16, { align: 'right' });

  // ── KPI CARDS ────────────────────────────────────────────────────────────
  let y = 26;
  const kpiH = 17;
  const kpiGap = 3;
  const kpiCount = 4;
  const kpiW = (usableW - kpiGap * (kpiCount - 1)) / kpiCount;

  drawKpiCard(doc, margin,                         y, kpiW, kpiH, 'Total Obras',           obras.length,  `${cantListo} listas • ${pendientes} pend.`, [37, 99, 235]);
  drawKpiCard(doc, margin + (kpiW + kpiGap),       y, kpiW, kpiH, 'Monto Total a Cobrar',  fmt(montoTotal), null,                                       [100, 116, 139]);
  drawKpiCard(doc, margin + (kpiW + kpiGap) * 2,   y, kpiW, kpiH, 'Listo p/ Certificar',   `${cantListo} obras`, fmt(montoParcial),                    [22, 163, 74]);
  drawKpiCard(doc, margin + (kpiW + kpiGap) * 3,   y, kpiW, kpiH, 'Requieren Atención',    faltanActas + pendientes + observados,
    `Actas: ${faltanActas} | Obs: ${observados}`, [200, 80, 20]);

  y += kpiH + 5;

  // ── TABLA ────────────────────────────────────────────────────────────────
  drawTableHeader(doc, cols, margin, y, headerH);
  y += headerH;

  obras.forEach((obra, idx) => {
    if (y + rowH > bodyBottom) {
      doc.addPage();
      addFooter(doc, pageW, pageH, margin, comuna, null, null);
      y = margin;
      drawTableHeader(doc, cols, margin, y, headerH);
      y += headerH;
    }

    const isEven = idx % 2 === 0;
    // fondo fila
    doc.setFillColor(isEven ? 245 : 255, isEven ? 248 : 255, isEven ? 252 : 255);
    doc.rect(margin, y, usableW, rowH, 'F');

    // Borde izquierdo de color por estado
    const estadoRgb = obra.estado_cobro === 'listo_certificar'
      ? ESTADO_COLOR.listo_certificar
      : obra.tramo_certificacion
        ? TRAMO_COLOR[obra.tramo_certificacion] || [100,100,100]
        : ESTADO_COLOR[obra.estado_cobro] || [150, 150, 150];
    doc.setFillColor(...estadoRgb);
    doc.rect(margin, y, 2, rowH, 'F');

    // línea divisoria inferior
    doc.setDrawColor(225, 230, 238);
    doc.setLineWidth(0.1);
    doc.line(margin, y + rowH, margin + usableW, y + rowH);

    // separadores verticales entre columnas
    let xSep = margin;
    cols.forEach((col, i) => {
      xSep += col.w;
      if (i < cols.length - 1) {
        doc.setDrawColor(235, 238, 245);
        doc.line(xSep, y + 1, xSep, y + rowH - 1);
      }
    });

    // Textos
    doc.setFontSize(6.8);
    const estab     = truncate(obra.establecimiento || obra.direccion || '—', 28);
    const titulo    = truncate(obra.titulo || '—', 36);
    const inspector = truncate(obra.inspector || '—', 18);
    const estadoLabel = ESTADO_LABEL[obra.estado_cobro] || obra.estado_cobro;
    const tramoLabel  = obra.tramo_certificacion === 'primer_50' ? '1er 50%'
                      : obra.tramo_certificacion === 'segundo_50' ? '2do 50%' : '';

    const pctColor = getPctColor(obra);

    const values = [
      estab,
      titulo,
      obra.oc_numero  || '—',
      obra.ada_numero || '—',
      inspector,
      obra.plazo_dias ? `${obra.plazo_dias}d` : '—',
      obra.porcentaje_avance > 0 ? `${parseFloat(obra.porcentaje_avance.toFixed(1))}%` : '—',
      fmt(obra.monto_contrato),
      fmt(obra.monto_a_cobrar),
      estadoLabel,
    ];

    let x = margin;
    values.forEach((val, vi) => {
      const col = cols[vi];
      const isRight = col.align === 'right';

      if (vi === 6) {
        doc.setTextColor(...pctColor);
        doc.setFont('helvetica', 'bold');
      } else if (vi === 9) {
        const rgb = obra.estado_cobro === 'listo_certificar'
          ? ESTADO_COLOR.listo_certificar
          : obra.tramo_certificacion
            ? TRAMO_COLOR[obra.tramo_certificacion] || [80,80,80]
            : ESTADO_COLOR[obra.estado_cobro] || [80,80,80];
        doc.setTextColor(...rgb);
        doc.setFont('helvetica', 'bold');
      } else if (vi === 8) {
        // Monto a cobrar en azul oscuro para destacar
        doc.setTextColor(30, 70, 160);
        doc.setFont('helvetica', 'bold');
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(45, 50, 60);
      }

      const textX = isRight ? x + col.w - 2 : x + 3;
      doc.text(String(val), textX, y + rowH - 2, { align: isRight ? 'right' : 'left' });
      x += col.w;
    });

    y += rowH;

    // Fila motivo observación
    if (obra.estado_cobro === 'observado' && obra.motivo_observacion) {
      if (y + 6 > bodyBottom) {
        doc.addPage();
        addFooter(doc, pageW, pageH, margin, comuna, null, null);
        y = margin;
        drawTableHeader(doc, cols, margin, y, headerH);
        y += headerH;
      }
      doc.setFillColor(250, 248, 235);
      doc.rect(margin, y, usableW, 5.5, 'F');
      doc.setFillColor(180, 140, 0);
      doc.rect(margin, y, 2, 5.5, 'F');
      doc.setTextColor(120, 100, 20);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'italic');
      doc.text(`  Motivo: ${truncate(obra.motivo_observacion, 150)}`, margin + 3, y + 3.8);
      doc.setFont('helvetica', 'normal');
      y += 5.5;
    }
  });

  // ── FOOTERS ───────────────────────────────────────────────────────────────
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    addFooter(doc, pageW, pageH, margin, comuna, i, pages);
  }

  doc.save(`certificacion_comuna_${comuna}_${new Date().toISOString().split('T')[0]}.pdf`);
}

function addFooter(doc, pageW, pageH, margin, comuna, current, total) {
  // Fondo footer
  doc.setFillColor(10, 20, 40);
  doc.rect(0, pageH - 9, pageW, 9, 'F');
  // Línea accent arriba
  doc.setFillColor(37, 99, 235);
  doc.rect(0, pageH - 9, pageW, 0.8, 'F');

  doc.setTextColor(150, 170, 200);
  doc.setFontSize(6.2);
  doc.setFont('helvetica', 'normal');
  doc.text(`MEJORES HOSPITALES S.A. — Certificación de Obras | Comuna ${comuna}`, margin, pageH - 3.5);
  if (current && total) {
    doc.setTextColor(100, 130, 180);
    doc.text(`Página ${current} / ${total}`, pageW - margin, pageH - 3.5, { align: 'right' });
  }
}