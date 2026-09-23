import jsPDF from 'jspdf';
import { calcularTotales } from '../components/certificados/acumulacionUtils';

// Parsea montos con precisión: maneja strings "1.098.000", "1,5", números JS, etc.
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

const round0 = (n) => { const x = parseMonto(n); return Math.round(x * 100) / 100; };
const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(round0(n));
const fmtC = (v) => { const n = round0(v); if (n === 0) return '0,00'; return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
const fmtDate = (d) => { try { if (!d) return '—'; const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; } catch { return d || '—'; } };

const MEJORES_LOGO_URL = 'https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/b6844473f_mejores_cover.jpg';
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
  } catch {
    return null;
  }
}

export async function exportCertificadoPDF(form) {
  const allItems = form.items || [];

  // Cálculo centralizado en acumulacionUtils → editor, vista previa y PDF
  // producen números idénticos (una sola fuente de verdad).
  const T = calcularTotales(form);
  const hasMedicion = T.hasMedicion;
  const subtotalContrato = T.subtotalContrato;
  const totalPresente = T.totalPresente;
  const totalAcumAnterior = T.totalAcumAnterior;
  const acumuladoAnterior = T.acumuladoAnterior;
  const acumuladoTotal = T.acumuladoTotal;
  const totalSaldo = T.totalSaldo;
  const pdfSubtotal = T.baseCalculo;
  const baseDeduccion = T.baseCalculo;
  const pdfAnticipo = T.anticipo;
  const fondoReparoCalculado = T.fondoReparoMonto;
  const pdfFondoReparo = T.fondoReparo;
  const pdfPagadoAnteriormente = T.pagadoAnteriormente;
  const pdfTotalNeto = T.totalNeto;
  const anteriorPorB = T.anteriorPorB;

  const itemsToRender = allItems;
  // Locales solo para las etiquetas de deducciones (% mostrado en el PDF)
  const anticipo_pct = parseMonto(form.anticipo_pct) || 0;
  const fondo_reparo_pct = parseMonto(form.fondo_reparo_pct) || 0;
  const porcentaje_pagado_anteriormente = parseMonto(form.porcentaje_pagado_anteriormente) || 0;

  const montoContratado = Math.round(parseMonto(form.monto_contratado) * 100) / 100;

  const firmaGerenteUrl = form.firma_gerente_url || (form.estado === 'aprobado' ? FIRMA_RAUL_GARCIA_URL : null);
  const firmaJefeUrl = form.firma_jefe_sitio_url || null;
  const [logoBase64, firmaGerenteBase64, firmaJefeBase64, ...cadenaBase64sRaw] = await Promise.all([
    loadImageAsBase64(MEJORES_LOGO_URL),
    firmaGerenteUrl ? loadImageAsBase64(firmaGerenteUrl) : Promise.resolve(null),
    firmaJefeUrl ? loadImageAsBase64(firmaJefeUrl) : Promise.resolve(null),
    // Firmas intermedias de la cadena (solo las que ya firmaron, en orden)
    ...((form.cadena_firmas || [])
      .filter(f => f.estado === 'firmado' && f.firma_url)
      .map(f => loadImageAsBase64(f.firma_url))),
  ]);
  const firmaBase64 = firmaGerenteBase64;
  // Entradas de cadena_firmas que ya tienen firma aplicada (para metadata: nombre, fecha)
  const cadenaFirmadas = (form.cadena_firmas || []).filter(f => f.estado === 'firmado' && f.firma_url);
  const cadenaBase64s = cadenaBase64sRaw;

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
    const fixedTotal = withoutDesc.reduce((s, d) => s + d.w, 0);
    const descW = C - fixedTotal;
    const allDefs = [
      withoutDesc[0],
      { label: 'DESCRIPCIÓN', align: 'left', w: descW },
      ...withoutDesc.slice(1),
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
  // Anchos disponibles para los valores de cada columna. El izquierdo arranca
  // en M+40 y debe caber hasta antes de la columna derecha; el derecho arranca
  // en W/2+48 y debe caber hasta W-M. Sin este wrapping, textos largos
  // (emprendimiento, obra/servicio, contratista) se amontonan o se interponen
  // con la columna opuesta.
  const L_KEY_X = M, L_VAL_X = M + 40;
  const L_VAL_MAXW = (W / 2 - 4) - L_VAL_X - 1;
  const R_KEY_X = W / 2 + 5, R_VAL_X = W / 2 + 48;
  const R_VAL_MAXW = (W - M) - R_VAL_X - 1;
  const INFO_LINE = 5.5;

  doc.setFontSize(8);
  const rows = Math.max(leftInfo.length, rightInfo.length);
  for (let i = 0; i < rows; i++) {
    let leftLines = [], rightLines = [];
    if (leftInfo[i]) {
      doc.setFont('helvetica', 'normal');
      leftLines = doc.splitTextToSize(String(leftInfo[i][1] || '—'), L_VAL_MAXW);
    }
    if (rightInfo[i]) {
      doc.setFont('helvetica', 'normal');
      rightLines = doc.splitTextToSize(String(rightInfo[i][1] || '—'), R_VAL_MAXW);
    }
    const lineCount = Math.max(leftLines.length, rightLines.length, 1);
    const ry = y;

    if (leftInfo[i]) {
      doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 80, 80);
      doc.text(leftInfo[i][0] + ':', L_KEY_X, ry);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 20, 20);
      leftLines.forEach((ln, li) => doc.text(ln, L_VAL_X, ry + li * INFO_LINE));
    }
    if (rightInfo[i]) {
      doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 80, 80);
      doc.text(rightInfo[i][0] + ':', R_KEY_X, ry);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 20, 20);
      rightLines.forEach((ln, li) => doc.text(ln, R_VAL_X, ry + li * INFO_LINE));
    }
    y += lineCount * INFO_LINE;
  }
  y += 4;

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

    const PAD = 1.2;

    const cell = (text, colIdx, bold = false, fontSize = 6) => {
      const col = TABLE_COLS[colIdx];
      const str = String(text ?? '');
      if (!str) return;
      doc.setFontSize(fontSize);
      if (bold) doc.setFont('helvetica', 'bold'); else doc.setFont('helvetica', 'normal');
      if (col.align === 'right') {
        const maxW = col.w - PAD * 2;
        const fitted = doc.splitTextToSize(str, maxW)[0] || str;
        doc.text(fitted, col.x + col.w - PAD, ty, { align: 'right' });
      } else {
        const maxW = col.w - PAD * 2;
        const fitted = doc.splitTextToSize(str, maxW)[0] || str;
        doc.text(fitted, col.x + PAD, ty, { align: 'left' });
      }
    };

    doc.setFontSize(6); doc.setFont('helvetica', 'normal');
    doc.text(String(item.numero || idx + 1), TABLE_COLS[0].x + TABLE_COLS[0].w - PAD, ty, { align: 'right' });
    doc.setFontSize(6);
    doc.text(descLines, TABLE_COLS[1].x + PAD, y + 4.2);
    cell(item.um || '', 2, false, 6);
    cell(cantStr, 3, false, 6);
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
  // Reservar espacio extra si la deducción de % pagado anteriormente va a
  // dibujarse; sin esto, con anticipo + fondo + pagado activos a la vez el
  // bloque de totales pisa el footer o las firmas.
  const TOTALS_H = (hasMedicion ? 58 : 38) + (pdfPagadoAnteriormente > 0 ? 7 : 0);
  if (y + TOTALS_H > SAFE_BOTTOM) {
    drawFooter(pageNum, '??');
    doc.addPage();
    pageNum++;
    drawPageHeader();
    y = 26;
  }
  y += 5;

  const pctCertificado = subtotalContrato > 0 ? (pdfSubtotal / subtotalContrato) * 100 : 0;

  if (hasMedicion) {
    // % pendiente sobre el contrato = 100 − % acumulado (ya pagado + avance actual).
    // Cuando el acumulado de certificación llega al 100%, el % pendiente es 0.
    const pctAcumulado = subtotalContrato > 0 ? (acumuladoTotal / subtotalContrato) * 100 : 0;
    const pctPendiente = Math.max(0, 100 - pctAcumulado);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(90, 90, 90);
    doc.text(`Total contrato: ${fmt(subtotalContrato)}`, W - M, y, { align: 'right' }); y += 6;
    doc.text(`Saldo pendiente: ${fmt(totalSaldo)}`, W - M, y, { align: 'right' }); y += 6;
    doc.text(`% Pendiente: ${pctPendiente.toFixed(1)}%`, W - M, y, { align: 'right' }); y += 6;
  }

  doc.setFillColor(235, 243, 255);
  doc.rect(W - M - 90, y, 90, 8, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(15, 28, 46);
  doc.text(hasMedicion ? 'IMP. CERTIFICADO:' : 'SUBTOTAL:', W - M - 88, y + 5.5);
  doc.text(fmt(pdfSubtotal), W - M - 1, y + 5.5, { align: 'right' });
  y += 10;

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
  if (pdfPagadoAnteriormente > 0) {
    doc.text(`Ya pagado anteriormente (${porcentaje_pagado_anteriormente}% · s/ total cto.):   ${fmt(pdfPagadoAnteriormente)}`, W - M, y, { align: 'right' }); y += 7;
  }

  doc.setFillColor(15, 28, 46);
  doc.rect(W - M - 90, y, 90, 10, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text('TOTAL NETO:', W - M - 88, y + 7);
  doc.text(fmt(pdfTotalNeto), W - M - 1, y + 7, { align: 'right' });
  y += 18;

  // ── Bloque de firmas ──────────────────────────────────────────────────────
  // Recolectar todas las firmas a renderizar, en orden: jefe → cadena → gerente.
  // Cada entrada lleva su base64 + metadata. Así el layout no depende de 3
  // bloques if separados y el wrap a múltiples filas es trivial.
  const firmas = [];
  if (firmaJefeBase64) {
    const fechaJefe = form.fecha_firma_jefe
      ? new Date(form.fecha_firma_jefe).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : null;
    firmas.push({
      base64: firmaJefeBase64,
      nombre: form.firmado_por_jefe || 'Jefe de Sitio',
      cargo: 'Jefe de Sitio',
      cargo2: fechaJefe ? `Firmado: ${fechaJefe}` : null,
      sello: '✓ Conforme',
    });
  }
  for (let ci = 0; ci < cadenaFirmadas.length; ci++) {
    const base64 = cadenaBase64s[ci];
    if (!base64) continue;
    const f = cadenaFirmadas[ci];
    const fechaFirma = f.fecha_firma
      ? new Date(f.fecha_firma).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : null;
    firmas.push({
      base64,
      nombre: f.firmado_por || f.full_name || 'Firmante',
      cargo: 'Firmante de cadena',
      cargo2: fechaFirma ? `Firmado: ${fechaFirma}` : null,
      sello: '✓ Conforme',
    });
  }
  if (firmaBase64) {
    const fechaGerente = form.fecha_aprobacion
      ? new Date(form.fecha_aprobacion).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : null;
    firmas.push({
      base64: firmaBase64,
      nombre: form.aprobado_por || 'Arq. Raúl García',
      cargo: 'Gerente de Contratos',
      cargo2: 'Mejores Hospitales S.A.',
      sello: fechaGerente ? `✓ Aprobado: ${fechaGerente}` : '✓ Aprobado',
    });
  }

  if (firmas.length > 0) {
    // Geometría: BLOCK_W=82 + GAP_X=12 → 3 por fila caben en C=277mm
    // (3×82 + 2×12 = 270). Con 4+ firmas se wrappea a múltiples filas.
    const BLOCK_W = 82;
    const IMG_H   = 30;
    const TEXT_H  = 20;
    const BLOCK_H = IMG_H + TEXT_H;
    const GAP_X   = 12;
    const GAP_Y   = 10;

    const MAX_PER_ROW = Math.max(1, Math.floor((C + GAP_X) / (BLOCK_W + GAP_X)));
    const rows = Math.ceil(firmas.length / MAX_PER_ROW);
    const neededH = rows * BLOCK_H + (rows - 1) * GAP_Y + 24;

    if (y + neededH > SAFE_BOTTOM) {
      drawFooter(pageNum, '??');
      doc.addPage();
      pageNum++;
      drawPageHeader();
      y = 26;
    }

    y += 10;

    // Pre-calcular dimensiones de cada imagen (aspect ratio) UNA vez.
    const firmaDims = await Promise.all(firmas.map(f => getImageDimensions(f.base64)));

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

    const drawFirmaBloque = (f, dims, bx) => {
      const by = y;
      const maxW = BLOCK_W;
      const maxH = IMG_H;
      let drawW = maxW, drawH = maxH;
      if (dims && dims.w && dims.h) {
        const ratio = dims.w / dims.h;
        if (ratio > maxW / maxH) {
          drawW = maxW; drawH = maxW / ratio;
        } else {
          drawH = maxH; drawW = maxH * ratio;
        }
      }
      const imgX = bx + (BLOCK_W - drawW) / 2;
      const imgY = by + (maxH - drawH) / 2;
      const imgFmt = f.base64.startsWith('data:image/jpeg') || f.base64.startsWith('data:image/jpg') ? 'JPEG' : 'PNG';
      doc.addImage(f.base64, imgFmt, imgX, imgY, drawW, drawH, undefined, 'NONE');

      // Línea divisoria bajo la imagen
      const lineY = by + IMG_H;
      doc.setDrawColor(170, 188, 212);
      doc.setLineWidth(0.4);
      doc.line(bx + 5, lineY, bx + BLOCK_W - 5, lineY);

      // Nombre
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 28, 46);
      doc.text(f.nombre, bx + BLOCK_W / 2, lineY + 5.5, { align: 'center', maxWidth: BLOCK_W - 4 });

      // Cargo 1
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(80, 95, 120);
      doc.text(f.cargo, bx + BLOCK_W / 2, lineY + 10.5, { align: 'center', maxWidth: BLOCK_W - 4 });

      // Cargo 2
      if (f.cargo2) {
        doc.text(f.cargo2, bx + BLOCK_W / 2, lineY + 15, { align: 'center', maxWidth: BLOCK_W - 4 });
      }

      // Sello
      if (f.sello) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.5);
        doc.setTextColor(34, 120, 70);
        doc.text(f.sello, bx + BLOCK_W / 2, by + BLOCK_H - 2.5, { align: 'center' });
      }
    };

    // Renderizar fila por fila con paginación dinámica. Cada fila se centra
    // independientemente y avanza Y por BLOCK_H + GAP_Y. Antes de cada fila
    // se verifica que entre en la página; si no, se agrega una nueva página
    // con header + título de continuación. Así NUNCA se superponen, sin
    // importar cuántos firmantes haya (3, 6, 9, 12+).
    for (let rowIdx = 0; rowIdx < rows; rowIdx++) {
      const start = rowIdx * MAX_PER_ROW;
      const rowFirmas = firmas.slice(start, start + MAX_PER_ROW);
      const rowDims = firmaDims.slice(start, start + MAX_PER_ROW);

      // Paginación per-row: si la fila no entra en lo que queda de página,
      // saltar a una nueva antes de renderizar. Esto garantiza que ningún
      // bloque de firma pise el footer ni se superponga con la fila anterior.
      if (y + BLOCK_H > SAFE_BOTTOM) {
        drawFooter(pageNum, '??');
        doc.addPage();
        pageNum++;
        drawPageHeader();
        y = 26;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 115, 140);
        doc.text('FIRMAS Y APROBACIÓN (continuación)', W / 2, y, { align: 'center' });
        y += 8;
      }

      const rowW = rowFirmas.length * BLOCK_W + (rowFirmas.length - 1) * GAP_X;
      const startX = (W - rowW) / 2;
      for (let i = 0; i < rowFirmas.length; i++) {
        const bx = startX + i * (BLOCK_W + GAP_X);
        drawFirmaBloque(rowFirmas[i], rowDims[i], bx);
      }
      y += BLOCK_H + (rowIdx < rows - 1 ? GAP_Y : 0);
    }
    y += 6;
  }

  // Footers finales
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(p, totalPages);
  }

  doc.save(`Certificado_N${form.numero}_${(form.contratista || '').replace(/ /g, '_')}.pdf`);
}