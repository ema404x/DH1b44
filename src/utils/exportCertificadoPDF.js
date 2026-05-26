import jsPDF from 'jspdf';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

// Parsea montos que pueden venir como string "1.098.000" o número 1098000 o erróneo 1.098
const parseMonto = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') {
    // Si el número es sospechosamente pequeño (< 100) para un monto de contrato,
    // puede ser un error de parseo (ej: 1.098 en lugar de 1098000).
    // En ese caso NO lo usamos — mejor retornar 0 y dejar que el subtotal tome el control.
    return v;
  }
  const clean = String(v).replace(/\./g, '').replace(',', '.');
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
};
const fmtDate = (d) => { try { if (!d) return '—'; const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; } catch { return d || '—'; } };

const MEJORES_LOGO_URL = 'https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/b6844473f_mejores_cover.jpg';
const FIRMA_RAUL_GARCIA_URL = 'https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/2ce21858e_generated_image.png';

async function loadImageAsBase64(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportCertificadoPDF(form) {
  const allItems = form.items || [];

  // Detectar si hay medición parcial:
  // Un ítem tiene medición si fue marcado explícitamente (_med_editado)
  // O si el presente difiere del total del ítem (detección automática al cargar desde BD)
  const hasMedicion = allItems.some(it => {
    if (it._med_editado) return true;
    const total = it.importe_total || (it.cantidad * it.importe_unitario) || 0;
    return it.med_presente_importe != null && it.med_presente_importe !== total;
  });

  // Si hay medición: usar med_presente_importe por ítem; si no: usar importe_total
  // Para el subtotal del contrato: suma de importe_total reales (solo los que tienen precio)
  const subtotalContrato = allItems.reduce((acc, it) => {
    const total = it.importe_total || (it.cantidad * it.importe_unitario) || 0;
    return acc + total;
  }, 0);

  const totalPresente = hasMedicion
    ? allItems.reduce((acc, it) => acc + (it.med_presente_importe || 0), 0)
    : 0;

  const totalSaldo = hasMedicion ? Math.max(0, subtotalContrato - totalPresente) : 0;
  const anticipo_pct = form.anticipo_pct ?? 0;
  const fondo_reparo_pct = form.fondo_reparo_pct ?? 0;

  // Mostrar SIEMPRE todos los ítems
  const itemsToRender = allItems;

  // El subtotal a certificar es lo que el usuario certificó (presente), o el total del contrato
  const pdfSubtotal = hasMedicion ? totalPresente : subtotalContrato;
  const pdfAnticipo = anticipo_pct > 0 ? pdfSubtotal * (anticipo_pct / 100) : 0;
  const pdfFondoReparo = fondo_reparo_pct > 0 ? pdfSubtotal * (fondo_reparo_pct / 100) : 0;
  const pdfTotalNeto = pdfSubtotal - pdfAnticipo - pdfFondoReparo;

  // Monto contratado: exactamente lo que el usuario ingresó, parseado correctamente
  const montoContratado = parseMonto(form.monto_contratado);

  const firmaUrl = form.firma_gerente_url || (form.estado === 'aprobado' ? FIRMA_RAUL_GARCIA_URL : null);
  const [logoBase64, firmaBase64] = await Promise.all([
    loadImageAsBase64(MEJORES_LOGO_URL),
    firmaUrl ? loadImageAsBase64(firmaUrl) : Promise.resolve(null),
  ]);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297, H = 210, M = 10, C = W - M * 2;
  const FOOTER_H = 10;
  const SAFE_BOTTOM = H - FOOTER_H - 5;

  const drawPageHeader = () => {
    doc.setFillColor(15, 28, 46);
    doc.rect(0, 0, W, 22, 'F');
    if (logoBase64) {
      doc.addImage(logoBase64, 'JPEG', M, 1.5, 46, 18);
    } else {
      doc.setTextColor(255, 255, 255); doc.setFontSize(13); doc.setFont('helvetica', 'bold');
      doc.text('MEJORES', M, 12);
    }
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text(`CERTIFICADO N° ${form.numero}`, W - M, 10, { align: 'right' });
    doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
    doc.text(
      `${form.tipo === 'abono_mensual' ? 'ABONO MENSUAL' : 'OBRA'} · ${fmtDate(form.fecha_certificado)}`,
      W - M, 17, { align: 'right' }
    );
  };

  const drawFooter = (pageNum, totalPages) => {
    doc.setFillColor(15, 28, 46);
    doc.rect(0, H - FOOTER_H, W, FOOTER_H, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
    doc.text('Av. Córdoba 1351 1°Piso · (C1055AAD) CABA · Tel 4816-0111 · www.mejores.ar', M, H - 3.5);
    doc.text(`CERT N° ${form.numero} · Pág ${pageNum}/${totalPages}`, W - M, H - 3.5, { align: 'right' });
  };

  const TABLE_COLS = (() => {
    const defs = [
      { w: 7,  label: 'N°',         align: 'right' },
      { w: 62, label: 'DESCRIPCIÓN', align: 'left'  },
      { w: 9,  label: 'UM',         align: 'left'  },
      { w: 12, label: 'CANT.',      align: 'right' },
      { w: 18, label: 'IMP.UNIT.',  align: 'right' },
      { w: 18, label: 'IMP.TOTAL',  align: 'right' },
      { w: 9,  label: 'A.ANT U',    align: 'right' },
      { w: 18, label: 'A.ANT $',    align: 'right' },
      { w: 9,  label: 'PRES. U',    align: 'right' },
      { w: 18, label: 'PRES. $',    align: 'right' },
      { w: 9,  label: 'A.PR. U',    align: 'right' },
      { w: 18, label: 'A.PR. $',    align: 'right' },
      { w: 9,  label: 'SALDO U',    align: 'right' },
      { w: 18, label: 'SALDO $',    align: 'right' },
    ];
    let cx = M;
    return defs.map(d => { const col = { ...d, x: cx }; cx += d.w; return col; });
  })();

  const DESCR_COL = TABLE_COLS[1];

  const drawTableHeader = (atY) => {
    const ROW_H = 8;
    doc.setFillColor(15, 28, 46);
    doc.rect(M, atY, C, ROW_H, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(6.5); doc.setFont('helvetica', 'bold');
    TABLE_COLS.forEach(({ x, w, label, align }) => {
      const cx = align === 'right' ? x + w - 1 : x + 1;
      doc.text(label, cx, atY + 5.5, { align: align === 'right' ? 'right' : 'left' });
    });
    return atY + ROW_H;
  };

  // PAGE 1
  drawPageHeader();
  let y = 26;
  let pageNum = 1;

  const leftInfo = [
    ['EMPRENDIMIENTO', form.emprendimiento],
    ['OBRA / SERVICIO', form.obra_servicio],
    ['CONTRATISTA', form.contratista],
    ['BASE', form.base || '—'],
  ];
  const rightInfo = [
    ['ADA N°', form.ada_numero],
    ['OC N°', form.oc_numero || '—'],
    ['MES / PERÍODO', form.mes_periodo],
    ['FECHA INICIO', fmtDate(form.fecha_inicio)],
    ['PLAZO', form.plazo_obra || '—'],
    ['FIN', fmtDate(form.fecha_finalizacion)],
    ['MONTO CONTRATADO', fmt(montoContratado)],
  ];
  const INFO_LINE = 5.5;
  doc.setFontSize(8); doc.setTextColor(40, 40, 40);
  leftInfo.forEach(([k, v], i) => {
    const ry = y + i * INFO_LINE;
    doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 80, 80); doc.text(k + ':', M, ry);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 20, 20);
    doc.text(String(v || '—'), M + 40, ry);
  });
  rightInfo.forEach(([k, v], i) => {
    const ry = y + i * INFO_LINE;
    doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 80, 80); doc.text(k + ':', W / 2 + 5, ry);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 20, 20);
    doc.text(String(v || '—'), W / 2 + 48, ry);
  });
  y += Math.max(leftInfo.length, rightInfo.length) * INFO_LINE + 4;

  doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3);
  doc.line(M, y, W - M, y);
  y += 4;

  y = drawTableHeader(y);

  doc.setFont('helvetica', 'normal');
  itemsToRender.forEach((item, idx) => {
    doc.setFontSize(7);
    const descLines = doc.splitTextToSize(item.descripcion || '', DESCR_COL.w - 2);
    const ROW_H = Math.max(7, descLines.length * 4.2 + 2);

    if (y + ROW_H > SAFE_BOTTOM) {
      drawFooter(pageNum, '??');
      doc.addPage();
      pageNum++;
      drawPageHeader();
      y = 26;
      y = drawTableHeader(y);
    }

    doc.setFillColor(idx % 2 === 0 ? 255 : 245, idx % 2 === 0 ? 255 : 247, idx % 2 === 0 ? 255 : 250);
    doc.rect(M, y, C, ROW_H, 'F');
    doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.15);
    doc.line(M, y + ROW_H, M + C, y + ROW_H);

    const ty = y + ROW_H / 2 + 2;
    doc.setFontSize(7); doc.setTextColor(40, 40, 40);

    doc.setFont('helvetica', 'normal');
    doc.text(String(item.numero || idx + 1), TABLE_COLS[0].x + TABLE_COLS[0].w - 1, ty, { align: 'right' });
    doc.text(descLines, DESCR_COL.x + 1, y + 4.5);
    doc.text(item.um || '', TABLE_COLS[2].x + 1, ty);

    const numCell = (val, colIdx, bold = false) => {
      const col = TABLE_COLS[colIdx];
      if (bold) doc.setFont('helvetica', 'bold'); else doc.setFont('helvetica', 'normal');
      doc.text(String(val ?? ''), col.x + col.w - 1, ty, { align: 'right' });
    };

    numCell(item.cantidad || '', 3);
    numCell(fmt(item.importe_unitario), 4);
    numCell(fmt(item.importe_total), 5, true);
    numCell(item.med_acum_anterior_unidad || 0, 6);
    numCell(fmt(item.med_acum_anterior_importe), 7);
    numCell(item.med_presente_unidad || 0, 8);
    numCell(fmt(item.med_presente_importe), 9);
    numCell(item.med_acum_presente_unidad || 0, 10);
    numCell(fmt(item.med_acum_presente_importe), 11);
    numCell(item.saldo_pendiente_unidad || 0, 12);
    numCell(fmt(item.saldo_pendiente_importe), 13);

    y += ROW_H;
  });

  // Totales
  const TOTALS_H = hasMedicion ? 52 : 38;
  if (y + TOTALS_H > SAFE_BOTTOM) {
    drawFooter(pageNum, '??');
    doc.addPage();
    pageNum++;
    drawPageHeader();
    y = 26;
  }
  y += 5;

  if (hasMedicion) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(90, 90, 90);
    doc.text(`Total contrato: ${fmt(subtotalContrato)}`, W - M, y, { align: 'right' }); y += 6;
    doc.text(`Saldo pendiente: ${fmt(totalSaldo)}`, W - M, y, { align: 'right' }); y += 6;
  }

  doc.setFillColor(235, 243, 255);
  doc.rect(W - M - 90, y, 90, 8, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(15, 28, 46);
  doc.text(hasMedicion ? 'IMP. CERTIFICADO:' : 'SUBTOTAL:', W - M - 88, y + 5.5);
  doc.text(fmt(pdfSubtotal), W - M - 1, y + 5.5, { align: 'right' });
  y += 10;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(90, 90, 90);
  if (pdfAnticipo > 0) {
    doc.text(`Anticipo/Desacopio (${anticipo_pct}%):   -${fmt(pdfAnticipo)}`, W - M, y, { align: 'right' }); y += 7;
  }
  if (pdfFondoReparo > 0) {
    doc.text(`Fondo de Reparo (${fondo_reparo_pct}%):   -${fmt(pdfFondoReparo)}`, W - M, y, { align: 'right' }); y += 7;
  }

  doc.setFillColor(15, 28, 46);
  doc.rect(W - M - 90, y, 90, 10, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text('TOTAL NETO:', W - M - 88, y + 7);
  doc.text(fmt(pdfTotalNeto), W - M - 1, y + 7, { align: 'right' });
  y += 18;

  // Bloque de firma de Raúl García (si el certificado está aprobado)
  if (firmaBase64) {
    const FIRMA_W = 60;
    const FIRMA_H = 22;
    const FIRMA_X = M;
    const FIRMA_Y = y;

    if (FIRMA_Y + FIRMA_H + 10 > SAFE_BOTTOM) {
      drawFooter(pageNum, '??');
      doc.addPage();
      pageNum++;
      drawPageHeader();
      y = 26;
    }

    doc.setDrawColor(200, 210, 230);
    doc.setLineWidth(0.2);
    doc.roundedRect(FIRMA_X, FIRMA_Y, FIRMA_W, FIRMA_H + 12, 1.5, 1.5, 'S');

    doc.addImage(firmaBase64, 'JPEG', FIRMA_X + 2, FIRMA_Y + 1, FIRMA_W - 4, FIRMA_H - 2);

    doc.setDrawColor(150, 170, 200);
    doc.setLineWidth(0.3);
    doc.line(FIRMA_X + 3, FIRMA_Y + FIRMA_H + 0.5, FIRMA_X + FIRMA_W - 3, FIRMA_Y + FIRMA_H + 0.5);

    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(15, 28, 46);
    doc.text(form.aprobado_por || 'Arq. Raúl García', FIRMA_X + 3, FIRMA_Y + FIRMA_H + 5.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(80, 90, 110);
    doc.text('Gerente de Contratos · Mejores Hospitales S.A.', FIRMA_X + 3, FIRMA_Y + FIRMA_H + 10);
    y += FIRMA_H + 16;
  }

  // Footers finales
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(p, totalPages);
  }

  doc.save(`Certificado_N${form.numero}_${(form.contratista || '').replace(/ /g, '_')}.pdf`);
}