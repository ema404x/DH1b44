import jsPDF from 'jspdf';

// ─── Helpers numéricos ────────────────────────────────────────────────────────
const parseMonto = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const s = String(v).trim();
  if (!s) return 0;
  const dots = (s.match(/\./g) || []).length;
  const commas = (s.match(/,/g) || []).length;
  let normalized = s;
  if (dots > 1) {
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else if (dots === 1 && commas === 0) {
    const afterDot = s.split('.')[1] || '';
    if (afterDot.length > 2) normalized = s.replace('.', '');
  } else if (commas >= 1) {
    if (dots === 0 && commas === 1) normalized = s.replace(',', '.');
    else normalized = s.replace(/\./g, '').replace(',', '.');
  }
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
};
const round0 = (n) => Math.round(parseMonto(n));
const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(round0(n));
const fmtC = (v) => { const n = round0(v); if (n === 0) return '—'; return n.toLocaleString('es-AR'); };
const fmtDate = (d) => { try { if (!d) return '—'; const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; } catch { return d || '—'; } };

// ─── Colores corporativos ──────────────────────────────────────────────────────
const NAVY   = [10, 37, 64];       // azul marino profundo
const GOLD   = [180, 140, 60];     // dorado corporativo
const GOLD_L = [212, 175, 55];     // dorado claro (acento)
const WHITE  = [255, 255, 255];
const GRAY1  = [35, 40, 50];       // texto principal
const GRAY2  = [80, 90, 108];      // texto secundario
const GRAY3  = [140, 150, 168];    // texto terciario
const GRAY4  = [210, 215, 225];    // bordes suaves
const BG_ROW = [247, 249, 252];    // fila alternada
const BG_CARD= [240, 244, 250];    // fondo info card
const ACCENT = [22, 90, 170];      // azul acento

// ─── URLs ─────────────────────────────────────────────────────────────────────
const MEJORES_LOGO_URL   = 'https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/b6844473f_mejores_cover.jpg';
const FIRMA_RAUL_GARCIA_URL = 'https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/3f708fc7a_firmaRaul2_page-0001.jpg';

function getImageDimensions(base64) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = base64;
  });
}

async function loadImageAsBase64(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

export async function exportCertificadoPDF(form) {
  const allItems = form.items || [];

  const hasMedicion = allItems.some(it => {
    if (it._med_editado) return true;
    const total = it.importe_total || (it.cantidad * it.importe_unitario) || 0;
    return it.med_presente_importe != null && it.med_presente_importe !== total;
  });

  const subtotalContrato = Math.round(allItems.reduce((acc, it) => {
    const total = round0(it.importe_total) || Math.round(parseMonto(it.cantidad) * round0(it.importe_unitario));
    return acc + total;
  }, 0));

  const totalPresente = hasMedicion
    ? Math.round(allItems.reduce((acc, it) => acc + round0(it.med_presente_importe), 0))
    : 0;

  const totalSaldo = hasMedicion ? Math.max(0, subtotalContrato - totalPresente) : 0;
  const anticipo_pct    = parseMonto(form.anticipo_pct) ?? 0;
  const fondo_reparo_pct = parseMonto(form.fondo_reparo_pct) ?? 0;

  const pdfSubtotal    = hasMedicion ? totalPresente : subtotalContrato;
  const baseDeduccion  = parseMonto(form.monto_contratado) > 0 ? parseMonto(form.monto_contratado) : subtotalContrato;
  const pdfAnticipo    = Math.round(form._anticipo_monto != null
    ? parseMonto(form._anticipo_monto)
    : (anticipo_pct > 0 ? baseDeduccion * (anticipo_pct / 100) : 0));
  const fondoReparoCalc = Math.round(form._fondo_reparo_monto != null
    ? parseMonto(form._fondo_reparo_monto)
    : (fondo_reparo_pct > 0 ? baseDeduccion * (fondo_reparo_pct / 100) : 0));
  const pdfFondoReparo = form.fondo_reparo_aplicar ? fondoReparoCalc : 0;
  const pdfTotalNeto   = pdfSubtotal - pdfAnticipo - pdfFondoReparo;
  const montoContratado = Math.round(parseMonto(form.monto_contratado));
  const pctCertificado  = subtotalContrato > 0 ? (pdfSubtotal / subtotalContrato) * 100 : 0;
  const itemsToRender   = allItems;

  // ─── Cargar imágenes ───────────────────────────────────────────────────────
  const firmaGerenteUrl = form.firma_gerente_url || (form.estado === 'aprobado' ? FIRMA_RAUL_GARCIA_URL : null);
  const firmaJefeUrl    = form.firma_jefe_sitio_url || null;
  const [logoBase64, firmaGerenteBase64, firmaJefeBase64] = await Promise.all([
    loadImageAsBase64(MEJORES_LOGO_URL),
    firmaGerenteUrl ? loadImageAsBase64(firmaGerenteUrl) : Promise.resolve(null),
    firmaJefeUrl    ? loadImageAsBase64(firmaJefeUrl)    : Promise.resolve(null),
  ]);
  const firmaBase64 = firmaGerenteBase64;

  // ─── Documento ────────────────────────────────────────────────────────────
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297, H = 210, M = 12, C = W - M * 2;
  const FOOTER_H = 11;
  const SAFE_BOTTOM = H - FOOTER_H - 4;
  const HEADER_H = 26;

  // ─── Funciones de ayuda rápidas ───────────────────────────────────────────
  const setColor  = (...rgb) => doc.setTextColor(...rgb);
  const setFill   = (...rgb) => doc.setFillColor(...rgb);
  const setDraw   = (...rgb) => doc.setDrawColor(...rgb);
  const setFont   = (style = 'normal', size = 8) => { doc.setFont('helvetica', style); doc.setFontSize(size); };

  // ─── CABECERA ─────────────────────────────────────────────────────────────
  const drawPageHeader = () => {
    // Fondo degradado simulado con 2 bandas
    setFill(...NAVY);
    doc.rect(0, 0, W, HEADER_H, 'F');
    // Banda dorada lateral izquierda (acento vertical)
    setFill(...GOLD_L);
    doc.rect(0, 0, 3, HEADER_H, 'F');

    // Logo
    if (logoBase64) {
      doc.addImage(logoBase64, 'JPEG', M + 4, 3, 44, 17);
    } else {
      setFont('bold', 14); setColor(...WHITE);
      doc.text('MEJORES', M + 4, 16);
    }

    // Separador vertical sutil
    setDraw(255, 255, 255, 0.15); doc.setLineWidth(0.3);
    doc.line(W / 2, 5, W / 2, HEADER_H - 5);

    // Título derecha
    setFont('bold', 13); setColor(...WHITE);
    doc.text(`CERTIFICADO N° ${form.numero}`, W - M, 11, { align: 'right' });

    // Subtítulo
    const tipoLabel = form.tipo === 'abono_mensual' ? 'ABONO MENSUAL DE MANTENIMIENTO' : 'CERTIFICADO DE OBRA';
    setFont('normal', 7); setColor(180, 200, 230);
    doc.text(`${tipoLabel}  ·  Emisión: ${fmtDate(form.fecha_certificado)}`, W - M, 17.5, { align: 'right' });

    // Estado badge
    const estadoLabel = form.estado === 'aprobado' ? 'APROBADO' : form.estado === 'emitido' ? 'EMITIDO' : 'BORRADOR';
    const estadoColor = form.estado === 'aprobado' ? [34, 140, 80] : form.estado === 'emitido' ? ACCENT : [130, 100, 20];
    setFill(...estadoColor); doc.roundedRect(W - M - 28, 19, 28, 6, 1, 1, 'F');
    setFont('bold', 5.5); setColor(...WHITE);
    doc.text(estadoLabel, W - M - 14, 23.2, { align: 'center' });
  };

  // ─── PIE DE PÁGINA ────────────────────────────────────────────────────────
  const drawFooter = (pageNum, totalPages) => {
    setFill(...NAVY);
    doc.rect(0, H - FOOTER_H, W, FOOTER_H, 'F');
    // Línea dorada sobre el pie
    setFill(...GOLD);
    doc.rect(0, H - FOOTER_H, W, 0.8, 'F');

    setFont('normal', 6); setColor(...GRAY3);
    doc.text('Mejores Hospitales S.A.  ·  Av. Córdoba 1351 1°Piso, CABA  ·  Tel 4816-0111  ·  www.mejores.ar', M, H - 4);
    doc.text(`Certificado N° ${form.numero}  ·  ${form.contratista || ''}  ·  Página ${pageNum} de ${totalPages}`, W - M, H - 4, { align: 'right' });
  };

  // ─── COLUMNAS DE TABLA ────────────────────────────────────────────────────
  const TABLE_COLS = (() => {
    const withoutDesc = [
      { label: 'N°',        align: 'center', w: 6  },
      { label: 'UM',        align: 'center', w: 7  },
      { label: 'CANT.',     align: 'right',  w: 9  },
      { label: 'IMP. UNIT.',align: 'right',  w: 23 },
      { label: 'IMP. TOT.', align: 'right',  w: 23 },
      { label: 'A.A.U',    align: 'right',  w: 7  },
      { label: 'ANT. $',   align: 'right',  w: 23 },
      { label: 'PR.U',     align: 'right',  w: 7  },
      { label: 'PRES. $',  align: 'right',  w: 23 },
      { label: 'A.P.U',    align: 'right',  w: 7  },
      { label: 'A.PR. $',  align: 'right',  w: 23 },
      { label: 'SA.U',     align: 'right',  w: 7  },
      { label: 'SALDO $',  align: 'right',  w: 23 },
    ];
    const fixedTotal = withoutDesc.reduce((s, d) => s + d.w, 0);
    const descW = C - fixedTotal;
    const allDefs = [withoutDesc[0], { label: 'DESCRIPCIÓN DEL ÍTEM', align: 'left', w: descW }, ...withoutDesc.slice(1)];
    let cx = M;
    return allDefs.map(d => { const x = cx; cx += d.w; return { ...d, x }; });
  })();

  const drawTableHeader = (atY) => {
    const ROW_H = 9;
    // Fondo header: azul navy con degradado simulado
    setFill(...NAVY);
    doc.rect(M, atY, C, ROW_H, 'F');
    // Línea dorada inferior del header
    setFill(...GOLD);
    doc.rect(M, atY + ROW_H - 0.8, C, 0.8, 'F');

    setFont('bold', 5.5); setColor(...WHITE);
    const PAD = 1.5;
    TABLE_COLS.forEach(({ x, w, label, align }) => {
      const maxW = w - PAD * 2;
      const fitted = doc.splitTextToSize(label, maxW)[0] || label;
      if (align === 'right') {
        doc.text(fitted, x + w - PAD, atY + 6, { align: 'right' });
      } else if (align === 'center') {
        doc.text(fitted, x + w / 2, atY + 6, { align: 'center' });
      } else {
        doc.text(fitted, x + PAD, atY + 6, { align: 'left' });
      }
    });
    return atY + ROW_H;
  };

  // ─── INICIO PÁGINA 1 ──────────────────────────────────────────────────────
  drawPageHeader();
  let y = HEADER_H + 4;
  let pageNum = 1;

  // ── Panel de información ──────────────────────────────────────────────────
  const INFO_H = 42;
  // Fondo panel info con borde sutil
  setFill(...BG_CARD);
  doc.roundedRect(M, y, C, INFO_H, 2, 2, 'F');
  setDraw(...GRAY4); doc.setLineWidth(0.25);
  doc.roundedRect(M, y, C, INFO_H, 2, 2, 'S');

  // Línea dorada superior del panel
  setFill(...GOLD);
  doc.rect(M, y, C, 1.2, 'F');

  // Título del panel
  setFont('bold', 6.5); setColor(...NAVY);
  doc.text('DATOS DEL CERTIFICADO', M + 5, y + 7);

  // Separador interior vertical
  const midX = M + C / 2;
  setDraw(...GRAY4); doc.setLineWidth(0.2);
  doc.line(midX, y + 10, midX, y + INFO_H - 4);

  const leftInfo = [
    ['EMPRENDIMIENTO',  form.emprendimiento],
    ['OBRA / SERVICIO', form.obra_servicio],
    ['CONTRATISTA',     form.contratista],
    ['BASE',            form.base || '—'],
  ];
  const rightInfo = [
    ['ADA N°',           form.ada_numero],
    ['OC N°',            form.oc_numero   || '—'],
    ['MES / PERÍODO',    form.mes_periodo],
    ['FECHA INICIO',     fmtDate(form.fecha_inicio)],
    ['PLAZO',            form.plazo_obra  || '—'],
    ['FINALIZACIÓN',     fmtDate(form.fecha_finalizacion)],
    ['MONTO CONTRATADO', fmt(montoContratado)],
  ];

  const INFO_LINE = 4.6;
  const infoY = y + 13;

  leftInfo.forEach(([k, v], i) => {
    const ry = infoY + i * INFO_LINE;
    setFont('bold', 6.5); setColor(...GRAY2);
    doc.text(k, M + 5, ry);
    setFont('normal', 7); setColor(...GRAY1);
    doc.text(String(v || '—'), M + 5, ry + 3);
  });

  rightInfo.forEach(([k, v], i) => {
    const ry = infoY + i * INFO_LINE;
    setFont('bold', 6); setColor(...GRAY2);
    doc.text(k, midX + 5, ry);
    setFont('normal', 7); setColor(...GRAY1);
    // Monto contratado en dorado/navy
    if (k === 'MONTO CONTRATADO') {
      setFont('bold', 7); setColor(...NAVY);
    }
    doc.text(String(v || '—'), midX + 5, ry + 3);
  });

  y += INFO_H + 5;

  // ── Tabla ─────────────────────────────────────────────────────────────────
  y = drawTableHeader(y);

  doc.setFont('helvetica', 'normal');
  itemsToRender.forEach((item, idx) => {
    const descLines = doc.splitTextToSize(item.descripcion || '', TABLE_COLS[1].w - 2.4);
    const ROW_H = Math.max(7, descLines.length * 4.2 + 2.5);

    if (y + ROW_H > SAFE_BOTTOM) {
      drawFooter(pageNum, '??');
      doc.addPage(); pageNum++;
      drawPageHeader(); y = HEADER_H + 4;
      y = drawTableHeader(y);
    }

    const isAlt = idx % 2 !== 0;
    if (isAlt) {
      setFill(...BG_ROW);
      doc.rect(M, y, C, ROW_H, 'F');
    } else {
      setFill(255, 255, 255);
      doc.rect(M, y, C, ROW_H, 'F');
    }
    // Borde inferior fila
    setDraw(...GRAY4); doc.setLineWidth(0.1);
    doc.line(M, y + ROW_H, M + C, y + ROW_H);

    const ty  = y + ROW_H / 2 + 2;
    const PAD = 1.5;

    const iu  = round0(item.importe_unitario);
    const it  = round0(item.importe_total);
    const aau = round0(item.med_acum_anterior_unidad);
    const aa$ = round0(item.med_acum_anterior_importe);
    const pu  = round0(item.med_presente_unidad);
    const p$  = round0(item.med_presente_importe);
    const apu = round0(item.med_acum_presente_unidad);
    const ap$ = round0(item.med_acum_presente_importe);
    const su  = round0(item.saldo_pendiente_unidad);
    const s$  = round0(item.saldo_pendiente_importe);
    const cant = parseMonto(item.cantidad);
    const cantStr = cant === 0 ? '' : (Number.isInteger(cant) ? String(cant) : cant.toFixed(2).replace('.', ','));

    const cell = (text, colIdx, bold = false, fontSize = 5.8, color = GRAY1) => {
      const col = TABLE_COLS[colIdx];
      const str = String(text ?? '');
      if (!str || str === '0') return;
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      setColor(...color);
      const maxW = col.w - PAD * 2;
      const fitted = doc.splitTextToSize(str, maxW)[0] || str;
      if (col.align === 'right') {
        doc.text(fitted, col.x + col.w - PAD, ty, { align: 'right' });
      } else if (col.align === 'center') {
        doc.text(fitted, col.x + col.w / 2, ty, { align: 'center' });
      } else {
        doc.text(fitted, col.x + PAD, ty, { align: 'left' });
      }
    };

    // N°
    doc.setFontSize(5.8); doc.setFont('helvetica', 'normal');
    setColor(...GRAY3);
    doc.text(String(item.numero || idx + 1), TABLE_COLS[0].x + TABLE_COLS[0].w / 2, ty, { align: 'center' });
    // Descripción
    doc.setFontSize(6); doc.setFont('helvetica', 'normal'); setColor(...GRAY1);
    doc.text(descLines, TABLE_COLS[1].x + PAD, y + 4.5);
    // UM
    cell(item.um || '', 2, false, 5.5, GRAY2);
    cell(cantStr,       3, false, 5.8, GRAY1);
    // Importes
    cell(fmtC(iu),             4, false, 5.5, GRAY2);
    cell(fmtC(it),             5, true,  5.8, NAVY);
    cell(aau || '',            6, false, 5.2, GRAY3);
    cell(aa$ ? fmtC(aa$) : '',7, false, 5.2, GRAY3);
    cell(pu  || '',            8, false, 5.2, GRAY2);
    cell(p$  ? fmtC(p$)  : '',9, false, 5.5, GRAY1);
    cell(apu || '',           10, false, 5.2, GRAY3);
    cell(ap$ ? fmtC(ap$) : '',11, false, 5.2, GRAY3);
    cell(su  || '',           12, false, 5.2, GRAY2);
    cell(s$  ? fmtC(s$)  : '',13, true,  5.8, ACCENT);

    y += ROW_H;
  });

  // Borde inferior de tabla
  setDraw(...NAVY); doc.setLineWidth(0.4);
  doc.line(M, y, M + C, y);

  // ─── BLOQUE DE TOTALES ─────────────────────────────────────────────────────
  const TOTALS_H = 60;
  if (y + TOTALS_H > SAFE_BOTTOM) {
    drawFooter(pageNum, '??');
    doc.addPage(); pageNum++;
    drawPageHeader(); y = HEADER_H + 4;
  }
  y += 6;

  // Panel de totales — alineado a la derecha
  const TOT_W = 110;
  const TOT_X = W - M - TOT_W;

  // Si hay medición, mostrar totales de contrato
  if (hasMedicion) {
    setFont('normal', 7); setColor(...GRAY2);
    doc.text(`Total del contrato:`, TOT_X, y);
    setFont('bold', 7); setColor(...GRAY1);
    doc.text(fmt(subtotalContrato), W - M, y, { align: 'right' });
    y += 5.5;
    doc.text(`Saldo pendiente:`, TOT_X, y);
    setFont('normal', 7);
    doc.text(fmt(totalSaldo), W - M, y, { align: 'right' });
    y += 7;
  }

  // Fila SUBTOTAL / IMP. CERTIFICADO
  setFill(230, 240, 255);
  doc.roundedRect(TOT_X - 2, y - 1, TOT_W + 2, 9, 1.5, 1.5, 'F');
  setDraw(...ACCENT); doc.setLineWidth(0.3);
  doc.roundedRect(TOT_X - 2, y - 1, TOT_W + 2, 9, 1.5, 1.5, 'S');

  setFont('bold', 8); setColor(...NAVY);
  doc.text(hasMedicion ? 'IMP. CERTIFICADO:' : 'SUBTOTAL:', TOT_X + 2, y + 5.5);
  doc.text(fmt(pdfSubtotal), W - M - 1, y + 5.5, { align: 'right' });
  y += 12;

  // Porcentaje
  if (pctCertificado > 0) {
    setFont('italic', 6.5); setColor(...GRAY3);
    doc.text(`Representa el ${pctCertificado.toFixed(1)}% del total del contrato`, W - M, y, { align: 'right' });
    y += 6;
  }

  // Deducciones
  setFont('normal', 7.5); setColor(...GRAY2);
  if (pdfAnticipo > 0) {
    const label = form.anticipo_monto_manual != null
      ? `Anticipo / Desacopio (monto fijo)`
      : `Anticipo / Desacopio (${anticipo_pct}%)`;
    doc.text(label, TOT_X, y);
    setColor(180, 60, 60);
    doc.text(`- ${fmt(pdfAnticipo)}`, W - M, y, { align: 'right' });
    y += 6.5;
  }
  if (pdfFondoReparo > 0) {
    const fondoNombre = form.fondo_reparo_label || 'Fondo de Reparo';
    const label = form.fondo_reparo_monto_manual != null
      ? `${fondoNombre} (monto fijo)`
      : `${fondoNombre} (${fondo_reparo_pct}%)`;
    setColor(...GRAY2);
    doc.text(label, TOT_X, y);
    setColor(180, 60, 60);
    doc.text(`- ${fmt(pdfFondoReparo)}`, W - M, y, { align: 'right' });
    y += 6.5;
  }

  // TOTAL NETO — caja premium
  if (pdfAnticipo > 0 || pdfFondoReparo > 0) {
    setDraw(...GRAY4); doc.setLineWidth(0.25);
    doc.line(TOT_X, y - 2, W - M, y - 2);
    y += 2;
  }
  setFill(...NAVY);
  doc.roundedRect(TOT_X - 2, y, TOT_W + 2, 12, 2, 2, 'F');
  // Banda dorada lateral del total
  setFill(...GOLD_L);
  doc.roundedRect(TOT_X - 2, y, 3, 12, 1, 1, 'F');

  setFont('bold', 9); setColor(...WHITE);
  doc.text('TOTAL NETO:', TOT_X + 5, y + 8);
  setFont('bold', 10); setColor(212, 235, 255);
  doc.text(fmt(pdfTotalNeto), W - M - 2, y + 8, { align: 'right' });
  y += 18;

  // ─── BLOQUE DE FIRMAS ─────────────────────────────────────────────────────
  const hasFirmaJefe    = !!firmaJefeBase64;
  const hasFirmaGerente = !!firmaBase64;

  if (hasFirmaJefe || hasFirmaGerente) {
    const BLOCK_W = 85;
    const IMG_H   = 26;
    const TEXT_H  = 24;
    const BLOCK_H = IMG_H + TEXT_H;
    const GAP     = 40;
    const count   = (hasFirmaJefe ? 1 : 0) + (hasFirmaGerente ? 1 : 0);
    const totalW  = count * BLOCK_W + (count - 1) * GAP;
    const startX  = (W - totalW) / 2;

    if (y + BLOCK_H + 20 > SAFE_BOTTOM) {
      drawFooter(pageNum, '??');
      doc.addPage(); pageNum++;
      drawPageHeader(); y = HEADER_H + 4;
    }

    // Separador elegante
    y += 4;
    setDraw(...GRAY4); doc.setLineWidth(0.25);
    doc.line(M, y, W - M, y);
    // Línea dorada centrada
    setDraw(...GOLD); doc.setLineWidth(0.6);
    const labelText = 'FIRMAS Y APROBACIÓN';
    const labelW = doc.getTextWidth(labelText) + 8;
    doc.line(W / 2 - labelW / 2 - 20, y, W / 2 - labelW / 2 - 4, y);
    doc.line(W / 2 + labelW / 2 + 4, y, W / 2 + labelW / 2 + 20, y);
    setFont('bold', 6.5); setColor(...GOLD);
    doc.text(labelText, W / 2, y + 0.5, { align: 'center', baseline: 'middle' });
    y += 8;

    // Pre-calcular aspect ratio de firmas
    const _firmaDims = {};
    let dimsIdx = 0;
    if (hasFirmaJefe) {
      const bx = startX + dimsIdx * (BLOCK_W + GAP);
      _firmaDims[bx] = await getImageDimensions(firmaJefeBase64);
      dimsIdx++;
    }
    if (hasFirmaGerente) {
      const bx = startX + dimsIdx * (BLOCK_W + GAP);
      _firmaDims[bx] = await getImageDimensions(firmaBase64);
    }

    const drawFirmaBloque = (base64, nombre, cargo, cargo2, sello, selloColor, bx) => {
      const by = y;

      // Sombra simulada
      setFill(200, 210, 225);
      doc.roundedRect(bx + 1.5, by + 1.5, BLOCK_W, BLOCK_H, 3, 3, 'F');

      // Fondo principal
      setFill(250, 252, 255);
      doc.roundedRect(bx, by, BLOCK_W, BLOCK_H, 3, 3, 'F');
      setDraw(195, 210, 230); doc.setLineWidth(0.4);
      doc.roundedRect(bx, by, BLOCK_W, BLOCK_H, 3, 3, 'S');

      // Barra superior de color (accent)
      setFill(...NAVY);
      doc.roundedRect(bx, by, BLOCK_W, 3, 1.5, 1.5, 'F');
      doc.rect(bx, by + 1.5, BLOCK_W, 1.5, 'F');

      // Área de imagen con fondo blanco
      setFill(255, 255, 255);
      doc.roundedRect(bx + 6, by + 5, BLOCK_W - 12, IMG_H - 6, 2, 2, 'F');
      setDraw(220, 228, 240); doc.setLineWidth(0.2);
      doc.roundedRect(bx + 6, by + 5, BLOCK_W - 12, IMG_H - 6, 2, 2, 'S');

      // Imagen con aspect ratio correcto
      const maxW = BLOCK_W - 18;
      const maxH = IMG_H - 10;
      const dims = _firmaDims[bx];
      let drawW = maxW, drawH = maxH;
      if (dims && dims.w && dims.h) {
        const ratio = dims.w / dims.h;
        if (ratio > maxW / maxH) { drawW = maxW; drawH = maxW / ratio; }
        else { drawH = maxH; drawW = maxH * ratio; }
      }
      const imgX = bx + (BLOCK_W - drawW) / 2;
      const imgY = by + 5 + ((IMG_H - 6) - drawH) / 2;
      doc.addImage(base64, 'PNG', imgX, imgY, drawW, drawH, undefined, 'FAST');

      // Línea divisoria
      const lineY = by + IMG_H + 2;
      setDraw(195, 210, 230); doc.setLineWidth(0.3);
      doc.line(bx + 8, lineY, bx + BLOCK_W - 8, lineY);

      // Nombre
      setFont('bold', 7.5); setColor(...NAVY);
      doc.text(nombre, bx + BLOCK_W / 2, lineY + 6, { align: 'center', maxWidth: BLOCK_W - 6 });

      // Cargo
      setFont('normal', 6); setColor(...GRAY2);
      doc.text(cargo, bx + BLOCK_W / 2, lineY + 11, { align: 'center', maxWidth: BLOCK_W - 6 });

      // Fecha / empresa
      if (cargo2) {
        setFont('italic', 5.8); setColor(...GRAY3);
        doc.text(cargo2, bx + BLOCK_W / 2, lineY + 16, { align: 'center', maxWidth: BLOCK_W - 6 });
      }

      // Sello de aprobación
      if (sello) {
        setFill(...(selloColor || [34, 120, 70]));
        doc.roundedRect(bx + 12, by + BLOCK_H - 8, BLOCK_W - 24, 6, 1.5, 1.5, 'F');
        setFont('bold', 5.5); setColor(255, 255, 255);
        doc.text(sello, bx + BLOCK_W / 2, by + BLOCK_H - 4.2, { align: 'center' });
      }
    };

    let firmaIdx = 0;
    if (hasFirmaJefe) {
      const bx = startX + firmaIdx * (BLOCK_W + GAP);
      const fechaJefe = form.fecha_firma_jefe
        ? new Date(form.fecha_firma_jefe).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : null;
      drawFirmaBloque(
        firmaJefeBase64,
        form.firmado_por_jefe || 'Jefe de Sitio',
        'Jefe de Sitio',
        fechaJefe ? `Firmado: ${fechaJefe}` : null,
        '✓ CONFORME',
        [30, 110, 70],
        bx
      );
      firmaIdx++;
    }
    if (hasFirmaGerente) {
      const bx = startX + firmaIdx * (BLOCK_W + GAP);
      const fechaGerente = form.fecha_aprobacion
        ? new Date(form.fecha_aprobacion).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : null;
      drawFirmaBloque(
        firmaBase64,
        form.aprobado_por || 'Arq. Raúl García',
        'Gerente de Contratos · Mejores Hospitales S.A.',
        fechaGerente ? `Aprobado: ${fechaGerente}` : null,
        '✓ APROBADO',
        [...NAVY],
        bx
      );
    }

    y += BLOCK_H + 6;
  }

  // ─── FOOTER TODAS LAS PÁGINAS ─────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(p, totalPages);
  }

  doc.save(`Certificado_N${form.numero}_${(form.contratista || '').replace(/ /g, '_')}.pdf`);
}