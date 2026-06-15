import jsPDF from 'jspdf';

// Parsea montos con precisión: maneja strings "1.098.000", "1,5", números JS, etc.
// Regla: si el string tiene MÁS de un punto → son separadores de miles (ej "1.098.000")
//         si tiene exactamente un punto y parte decimal <= 2 dígitos → puede ser decimal
//         si tiene exactamente un punto y parte decimal > 2 dígitos → separador de miles
const parseMonto = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const s = String(v).trim();
  if (!s) return 0;
  // Reemplazar comas decimales por punto temporal
  // Contar puntos
  const dots = (s.match(/\./g) || []).length;
  const commas = (s.match(/,/g) || []).length;
  let normalized = s;
  if (dots > 1) {
    // Múltiples puntos → separadores de miles, posible coma decimal
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else if (dots === 1 && commas === 0) {
    // Un solo punto: verificar si es decimal o miles
    const afterDot = s.split('.')[1] || '';
    if (afterDot.length > 2) {
      // Más de 2 dígitos tras el punto → separador de miles
      normalized = s.replace('.', '');
    }
    // Si <= 2 dígitos → decimal real, dejar como está
  } else if (commas >= 1) {
    // Coma: separador de miles o decimal
    if (dots === 0 && commas === 1) {
      // Solo una coma → decimal
      normalized = s.replace(',', '.');
    } else {
      // Múltiples comas o coma + punto → coma es decimal, puntos son miles
      normalized = s.replace(/\./g, '').replace(',', '.');
    }
  }
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
};

// Redondea al entero más cercano para evitar decimales basura de floating point
const round0 = (n) => Math.round(parseMonto(n));

// Formato moneda ARS sin decimales, sin símbolo $ para tablas
const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(round0(n));

// Formato compacto para celdas de tabla: sin símbolo $, número completo con separadores de miles
const fmtC = (v) => {
  const n = round0(v);
  if (n === 0) return '0';
  return n.toLocaleString('es-AR');
};
const fmtDate = (d) => { try { if (!d) return '—'; const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; } catch { return d || '—'; } };

const MEJORES_LOGO_URL = 'https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/b6844473f_mejores_cover.jpg';
const FIRMA_RAUL_GARCIA_URL = 'https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/3f708fc7a_firmaRaul2_page-0001.jpg';

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
  const subtotalContrato = Math.round(allItems.reduce((acc, it) => {
    const total = round0(it.importe_total) || Math.round(parseMonto(it.cantidad) * round0(it.importe_unitario));
    return acc + total;
  }, 0));

  const totalPresente = hasMedicion
    ? Math.round(allItems.reduce((acc, it) => acc + round0(it.med_presente_importe), 0))
    : 0;

  const totalSaldo = hasMedicion ? Math.max(0, subtotalContrato - totalPresente) : 0;
  const anticipo_pct = parseMonto(form.anticipo_pct) ?? 0;
  const fondo_reparo_pct = parseMonto(form.fondo_reparo_pct) ?? 0;

  // Mostrar SIEMPRE todos los ítems
  const itemsToRender = allItems;

  const pdfSubtotal = hasMedicion ? totalPresente : subtotalContrato;
  const baseDeduccion = parseMonto(form.monto_contratado) > 0 ? parseMonto(form.monto_contratado) : subtotalContrato;
  const pdfAnticipo = Math.round(form._anticipo_monto != null
    ? parseMonto(form._anticipo_monto)
    : (anticipo_pct > 0 ? baseDeduccion * (anticipo_pct / 100) : 0));
  const fondoReparoCalculado = Math.round(form._fondo_reparo_monto != null
    ? parseMonto(form._fondo_reparo_monto)
    : (fondo_reparo_pct > 0 ? baseDeduccion * (fondo_reparo_pct / 100) : 0));
  const pdfFondoReparo = form.fondo_reparo_aplicar ? fondoReparoCalculado : 0;
  const pdfTotalNeto = pdfSubtotal - pdfAnticipo - pdfFondoReparo;

  const montoContratado = Math.round(parseMonto(form.monto_contratado));

  const firmaGerenteUrl = form.firma_gerente_url || (form.estado === 'aprobado' ? FIRMA_RAUL_GARCIA_URL : null);
  const firmaJefeUrl = form.firma_jefe_sitio_url || null;
  const [logoBase64, firmaGerenteBase64, firmaJefeBase64] = await Promise.all([
    loadImageAsBase64(MEJORES_LOGO_URL),
    firmaGerenteUrl ? loadImageAsBase64(firmaGerenteUrl) : Promise.resolve(null),
    firmaJefeUrl ? loadImageAsBase64(firmaJefeUrl) : Promise.resolve(null),
  ]);
  // backward-compat alias
  const firmaBase64 = firmaGerenteBase64;

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

  // Ancho total de tabla = C = 277mm (A4 landscape - 2*10 margins)
  // N°(5) + DESC(44) + UM(7) + CANT(8) + IU(21) + IT(21) + AaU(6) + Aa$(21) + PrU(6) + Pr$(21) + ApU(6) + Ap$(21) + SaU(6) + Sa$(21) = 214
  // 5+44+7+8+21+21+6+21+6+21+6+21+6+21 = 214 → agregar al DESC: 277-214+44 = 107. 
  // Recuento sin DESC: 5+7+8+21+21+6+21+6+21+6+21+6+21 = 170 → DESC = 277-170 = 107? Demasiado.
  // Optimizado: 6 cols $ de 20mm + 5 cols U de 6mm + DESC flexible
  // Fijo: N°5 + UM6 + CANT8 + 6*20(montos)=120 + 5*6(unidades)=30 → sin DESC: 5+6+8+120+30=169 → DESC=108
  // Mejor usar DESC=48 y expandir montos a 22: 5+48+6+8+22+22+6+22+6+22+6+22+6+22=223 → faltan 54. 
  // SOLUCIÓN DEFINITIVA: calcular DESC dinámicamente para sumar exactamente C=277
  const TABLE_COLS = (() => {
    // Anchos fijos de todas las columnas. DESC se calcula dinámicamente para sumar exactamente C=277mm.
    // Sin DESC: N°(6)+UM(7)+CANT(9)+IU(23)+IT(23)+AAU(7)+AA$(23)+PU(7)+P$(23)+APU(7)+AP$(23)+SU(7)+S$(23) = 188
    // DESC = 277 - 188 = 89mm
    const withoutDesc = [
      { label: 'N°',        align: 'right', w: 6  },
      { label: 'UM',        align: 'left',  w: 7  },
      { label: 'CANT.',     align: 'right', w: 9  },
      { label: 'IMP.UNIT.', align: 'right', w: 23 },
      { label: 'IMP.TOT.',  align: 'right', w: 23 },
      { label: 'A.A.U',    align: 'right', w: 7  },
      { label: 'A.ANT$',   align: 'right', w: 23 },
      { label: 'PR.U',     align: 'right', w: 7  },
      { label: 'PRES.$',   align: 'right', w: 23 },
      { label: 'A.P.U',    align: 'right', w: 7  },
      { label: 'A.PR.$',   align: 'right', w: 23 },
      { label: 'SA.U',     align: 'right', w: 7  },
      { label: 'SALDO$',   align: 'right', w: 23 },
    ];
    const fixedTotal = withoutDesc.reduce((s, d) => s + d.w, 0); // = 188
    const descW = C - fixedTotal; // = 277 - 188 = 89
    // Insertar DESC en posición 1 (después de N°)
    const allDefs = [
      withoutDesc[0], // N°
      { label: 'DESCRIPCIÓN', align: 'left', w: descW }, // DESC = 89
      ...withoutDesc.slice(1), // UM en adelante
    ];
    let cx = M;
    return allDefs.map(d => { const x = cx; cx += d.w; return { ...d, x }; });
  })();

  const drawTableHeader = (atY) => {
    const ROW_H = 8;
    doc.setFillColor(15, 28, 46);
    doc.rect(M, atY, C, ROW_H, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(5.5); doc.setFont('helvetica', 'bold');
    TABLE_COLS.forEach(({ x, w, label, align }) => {
      const PAD = 1.2;
      const cx = align === 'right' ? x + w - PAD : x + PAD;
      // Recortar label si es necesario
      const maxW = w - PAD * 2;
      const fitted = doc.splitTextToSize(label, maxW)[0] || label;
      doc.text(fitted, cx, atY + 5.5, { align: align === 'right' ? 'right' : 'left' });
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
    doc.setFontSize(6);
    const descLines = doc.splitTextToSize(item.descripcion || '', TABLE_COLS[1].w - 2.4);
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
    doc.setTextColor(40, 40, 40);

    // Sanitizar valores numéricos del ítem
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
    // Cantidad: mostrar con hasta 2 decimales si tiene, si no entero
    const cant = parseMonto(item.cantidad);
    const cantStr = cant === 0 ? '' : (Number.isInteger(cant) ? String(cant) : cant.toFixed(2).replace('.', ','));

    const PAD = 1.2; // padding interno por lado para evitar superposición

    // Helper: renderiza texto recortado dentro de los límites de la columna
    const cell = (text, colIdx, bold = false, fontSize = 6) => {
      const col = TABLE_COLS[colIdx];
      const str = String(text ?? '');
      if (!str) return;
      doc.setFontSize(fontSize);
      if (bold) doc.setFont('helvetica', 'bold'); else doc.setFont('helvetica', 'normal');
      if (col.align === 'right') {
        // Recortar para que no supere el límite derecho de la columna
        const maxW = col.w - PAD * 2;
        const fitted = doc.splitTextToSize(str, maxW)[0] || str;
        doc.text(fitted, col.x + col.w - PAD, ty, { align: 'right' });
      } else {
        const maxW = col.w - PAD * 2;
        const fitted = doc.splitTextToSize(str, maxW)[0] || str;
        doc.text(fitted, col.x + PAD, ty, { align: 'left' });
      }
    };

    // N° y descripción — fuente 6pt
    doc.setFontSize(6); doc.setFont('helvetica', 'normal');
    doc.text(String(item.numero || idx + 1), TABLE_COLS[0].x + TABLE_COLS[0].w - PAD, ty, { align: 'right' });
    // Descripción con wrap dentro del ancho exacto de la columna
    doc.setFontSize(6);
    doc.text(descLines, TABLE_COLS[1].x + PAD, y + 4.2);
    // UM
    cell(item.um || '', 2, false, 6);
    // Cantidad
    cell(cantStr, 3, false, 6);
    // Columnas numéricas — fuente 5.5pt para que 1.800.000 siempre quepa en 23mm
    cell(fmtC(iu),          4, false, 5.5);
    cell(fmtC(it),          5, true,  5.5);
    cell(aau || '',         6, false, 5.5);
    cell(aa$ ? fmtC(aa$) : '', 7, false, 5.5);
    cell(pu  || '',         8, false, 5.5);
    cell(p$  ? fmtC(p$)  : '', 9, false, 5.5);
    cell(apu || '',        10, false, 5.5);
    cell(ap$ ? fmtC(ap$) : '',11, false, 5.5);
    cell(su  || '',        12, false, 5.5);
    cell(s$  ? fmtC(s$)  : '',13, true,  5.5);

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

  // % certificado sobre el total del contrato
  const pctCertificado = subtotalContrato > 0 ? (pdfSubtotal / subtotalContrato) * 100 : 0;

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

  // Porcentaje certificado — sutil, en gris claro
  if (pctCertificado > 0) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(6.5); doc.setTextColor(140, 150, 165);
    doc.text(`Representa el ${pctCertificado.toFixed(1)}% del total del contrato`, W - M, y, { align: 'right' });
    y += 6;
  }

  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(90, 90, 90);
  if (pdfAnticipo > 0) {
    const antiLabel = form.anticipo_monto_manual != null
      ? `Anticipo/Desacopio (monto fijo):   -${fmt(pdfAnticipo)}`
      : `Anticipo/Desacopio (${anticipo_pct}%):   -${fmt(pdfAnticipo)}`;
    doc.text(antiLabel, W - M, y, { align: 'right' }); y += 7;
  }
  if (pdfFondoReparo > 0) {
    const fondoNombre = form.fondo_reparo_label || 'Fondo de Reparo';
    const fondoLabel = form.fondo_reparo_monto_manual != null
      ? `${fondoNombre} (monto fijo):   -${fmt(pdfFondoReparo)}`
      : `${fondoNombre} (${fondo_reparo_pct}%):   -${fmt(pdfFondoReparo)}`;
    doc.text(fondoLabel, W - M, y, { align: 'right' }); y += 7;
  }

  doc.setFillColor(15, 28, 46);
  doc.rect(W - M - 90, y, 90, 10, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text('TOTAL NETO:', W - M - 88, y + 7);
  doc.text(fmt(pdfTotalNeto), W - M - 1, y + 7, { align: 'right' });
  y += 18;

  // ── Bloque de firmas profesional ─────────────────────────────────────────────
  const hasFirmaJefe    = !!firmaJefeBase64;
  const hasFirmaGerente = !!firmaBase64;

  if (hasFirmaJefe || hasFirmaGerente) {
    const BLOCK_W  = 80;   // ancho de cada bloque
    const IMG_H    = 24;   // alto del área de la imagen
    const TEXT_H   = 22;   // alto del área de texto bajo la imagen
    const BLOCK_H  = IMG_H + TEXT_H;
    const GAP      = 30;   // espacio entre bloques

    const count    = (hasFirmaJefe ? 1 : 0) + (hasFirmaGerente ? 1 : 0);
    const totalW   = count * BLOCK_W + (count - 1) * GAP;
    const startX   = (W - totalW) / 2;

    const neededH  = BLOCK_H + 18;
    if (y + neededH > SAFE_BOTTOM) {
      drawFooter(pageNum, '??');
      doc.addPage();
      pageNum++;
      drawPageHeader();
      y = 26;
    }

    y += 10;

    // Línea separadora
    doc.setDrawColor(200, 212, 228);
    doc.setLineWidth(0.3);
    doc.line(M, y - 5, W - M, y - 5);

    // Título sección
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 115, 140);
    doc.text('FIRMAS Y APROBACIÓN', W / 2, y, { align: 'center' });
    y += 6;

    const drawFirmaBloque = (base64, nombre, cargo, cargo2, sello, bx) => {
      const by = y;

      // Fondo suave
      doc.setFillColor(248, 250, 253);
      doc.roundedRect(bx, by, BLOCK_W, BLOCK_H, 2.5, 2.5, 'F');
      doc.setDrawColor(185, 202, 222);
      doc.setLineWidth(0.3);
      doc.roundedRect(bx, by, BLOCK_W, BLOCK_H, 2.5, 2.5, 'S');

      // Imagen de firma centrada horizontalmente, con padding lateral
      const imgPad = 8;
      const imgW = BLOCK_W - imgPad * 2;
      doc.addImage(base64, 'PNG', bx + imgPad, by + 2, imgW, IMG_H - 3, undefined, 'FAST');

      // Línea divisoria bajo la imagen
      const lineY = by + IMG_H;
      doc.setDrawColor(170, 188, 212);
      doc.setLineWidth(0.4);
      doc.line(bx + 6, lineY, bx + BLOCK_W - 6, lineY);

      // Nombre — bold, 7.5pt
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 28, 46);
      doc.text(nombre, bx + BLOCK_W / 2, lineY + 5.5, { align: 'center', maxWidth: BLOCK_W - 4 });

      // Cargo 1
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(80, 95, 120);
      doc.text(cargo, bx + BLOCK_W / 2, lineY + 10.5, { align: 'center', maxWidth: BLOCK_W - 4 });

      // Cargo 2 (ej: empresa o fecha)
      if (cargo2) {
        doc.text(cargo2, bx + BLOCK_W / 2, lineY + 15, { align: 'center', maxWidth: BLOCK_W - 4 });
      }

      // Sello
      if (sello) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.5);
        doc.setFillColor(34, 120, 70);
        doc.setTextColor(34, 120, 70);
        doc.text(sello, bx + BLOCK_W / 2, by + BLOCK_H - 2.5, { align: 'center' });
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
        '✓ Conforme',
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
        'Gerente de Contratos',
        'Mejores Hospitales S.A.',
        fechaGerente ? `✓ Aprobado: ${fechaGerente}` : '✓ Aprobado',
        bx
      );
    }

    y += BLOCK_H + 6;
  }

  // Footers finales
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(p, totalPages);
  }

  doc.save(`Certificado_N${form.numero}_${(form.contratista || '').replace(/ /g, '_')}.pdf`);
}