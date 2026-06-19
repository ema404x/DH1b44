import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import jsPDF from 'npm:jspdf@4.0.0';

// Feriados fijos argentinos
const FERIADOS_FIJOS = [
  { month: 1, day: 1 },
  { month: 3, day: 24 },
  { month: 4, day: 2 },
  { month: 5, day: 1 },
  { month: 5, day: 25 },
  { month: 6, day: 20 },
  { month: 7, day: 9 },
  { month: 8, day: 17 },
  { month: 10, day: 12 },
  { month: 11, day: 20 },
  { month: 12, day: 8 },
  { month: 12, day: 25 },
];

function isHoliday(date) {
  return FERIADOS_FIJOS.some(h => h.month === date.getMonth() + 1 && h.day === date.getDate());
}

function isBusinessDay(date) {
  const d = date.getDay();
  return d !== 0 && d !== 6 && !isHoliday(date);
}

function getLastBusinessDayOfMonth(year, month) {
  const lastDay = new Date(year, month, 0).getDate();
  let date = new Date(year, month - 1, lastDay);
  while (!isBusinessDay(date)) {
    date.setDate(date.getDate() - 1);
  }
  return date;
}

// Parsea montos que pueden venir como string "1.234.567" (separador de miles con punto)
// o número nativo. Nunca usa parseFloat directo sobre strings con puntos de miles.
const parseMonto = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  // Remover puntos de miles y reemplazar coma decimal por punto
  const clean = String(v).replace(/\./g, '').replace(',', '.');
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
};

// Formatea como moneda ARS sin depender de Intl (puede fallar en Deno con es-AR)
const fmt = (v) => {
  const n = typeof v === 'number' ? v : parseMonto(v);
  if (!n && n !== 0) return '$ 0';
  // Formatear manualmente con puntos de miles
  const parts = Math.round(n).toString().split('');
  const result = [];
  parts.reverse().forEach((d, i) => {
    if (i > 0 && i % 3 === 0) result.push('.');
    result.push(d);
  });
  return '$ ' + result.reverse().join('');
};

const fmtDate = (d) => {
  try {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  } catch { return d || '—'; }
};

const MEJORES_LOGO_URL = 'https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/b6844473f_mejores_cover.jpg';

async function loadLogoBase64() {
  try {
    const res = await fetch(MEJORES_LOGO_URL);
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return 'data:image/jpeg;base64,' + btoa(binary);
  } catch { return null; }
}

async function generateCertificatePDF(certificado) {
  const logoBase64 = await loadLogoBase64();

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297, H = 210, M = 10, C = W - M * 2;
  const FOOTER_H = 10;
  const SAFE_BOTTOM = H - FOOTER_H - 5;

  const allItems = certificado.items || [];

  // Para abono mensual: no hay medición parcial, el subtotal es la suma de importe_total de ítems
  const subtotalContrato = allItems.reduce((acc, it) => {
    return acc + (parseMonto(it.importe_total) || (parseMonto(it.cantidad) * parseMonto(it.importe_unitario)) || 0);
  }, 0);

  // Solo aplica anticipo/fondo si están explícitamente definidos y > 0 en el abono maestro
  const anticipo_pct = parseFloat(certificado.anticipo_pct) || 0;
  const fondo_reparo_pct = parseFloat(certificado.fondo_reparo_pct) || 0;
  const pdfSubtotal = subtotalContrato || parseMonto(certificado.subtotal) || 0;
  const pdfAnticipo = anticipo_pct > 0 ? pdfSubtotal * (anticipo_pct / 100) : 0;
  const pdfFondoReparo = fondo_reparo_pct > 0 ? pdfSubtotal * (fondo_reparo_pct / 100) : 0;
  const pdfTotalNeto = pdfSubtotal - pdfAnticipo - pdfFondoReparo;

  const montoContratado = parseMonto(certificado.monto_contratado);

  const drawPageHeader = () => {
    doc.setFillColor(15, 28, 46);
    doc.rect(0, 0, W, 22, 'F');
    if (logoBase64) {
      doc.addImage(logoBase64, 'JPEG', M, 1.5, 46, 18);
    } else {
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('MEJORES', M, 12);
    }
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`CERTIFICADO N° ${certificado.numero}`, W - M, 10, { align: 'right' });
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `ABONO MENSUAL · ${fmtDate(certificado.fecha_certificado)}`,
      W - M, 17, { align: 'right' }
    );
  };

  const drawFooter = (pageNum, totalPages) => {
    doc.setFillColor(15, 28, 46);
    doc.rect(0, H - FOOTER_H, W, FOOTER_H, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Av. Córdoba 1351 1°Piso · (C1055AAD) CABA · Tel 4816-0111 · www.mejores.ar', M, H - 3.5);
    doc.text(`CERT N° ${certificado.numero} · Pág ${pageNum}/${totalPages}`, W - M, H - 3.5, { align: 'right' });
  };

  // Columnas de la tabla — igual que exportCertificadoPDF (sin columnas de medición para abono mensual simplificado)
  const TABLE_COLS = (() => {
    const defs = [
      { w: 7,  label: 'N°',        align: 'right' },
      { w: 100,label: 'DESCRIPCIÓN', align: 'left'  },
      { w: 12, label: 'UM',        align: 'left'   },
      { w: 14, label: 'CANT.',     align: 'right'  },
      { w: 30, label: 'IMP. UNIT.',align: 'right'  },
      { w: 34, label: 'IMP. TOTAL',align: 'right'  },
    ];
    let cx = M;
    return defs.map(d => { const col = { ...d, x: cx }; cx += d.w; return col; });
  })();

  const DESCR_COL = TABLE_COLS[1];

  const drawTableHeader = (atY) => {
    const ROW_H = 8;
    doc.setFillColor(15, 28, 46);
    doc.rect(M, atY, C, ROW_H, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
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

  // Info del certificado
  const leftInfo = [
    ['EMPRENDIMIENTO', certificado.emprendimiento],
    ['OBRA / SERVICIO', certificado.obra_servicio],
    ['CONTRATISTA', certificado.contratista],
    ['BASE', certificado.base || '—'],
  ];
  const rightInfo = [
    ['ADA N°', certificado.ada_numero],
    ['OC N°', certificado.oc_numero || '—'],
    ['MES / PERÍODO', certificado.mes_periodo],
    ['FECHA INICIO', fmtDate(certificado.fecha_inicio)],
    ['PLAZO', certificado.plazo_obra || '—'],
    ['FIN', fmtDate(certificado.fecha_finalizacion)],
    ['MONTO CONTRATADO', fmt(montoContratado)],
  ];

  const INFO_LINE = 5.5;
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);
  leftInfo.forEach(([k, v], i) => {
    const ry = y + i * INFO_LINE;
    doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 80, 80); doc.text(k + ':', M, ry);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 20, 20); doc.text(String(v || '—'), M + 40, ry);
  });
  rightInfo.forEach(([k, v], i) => {
    const ry = y + i * INFO_LINE;
    doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 80, 80); doc.text(k + ':', W / 2 + 5, ry);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 20, 20); doc.text(String(v || '—'), W / 2 + 48, ry);
  });
  y += Math.max(leftInfo.length, rightInfo.length) * INFO_LINE + 4;

  doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3);
  doc.line(M, y, W - M, y);
  y += 4;

  y = drawTableHeader(y);

  // Filas de ítems
  doc.setFont('helvetica', 'normal');
  allItems.forEach((item, idx) => {
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

    const col = TABLE_COLS;
    doc.setFont('helvetica', 'normal');
    doc.text(String(item.numero || idx + 1), col[0].x + col[0].w - 1, ty, { align: 'right' });
    doc.text(descLines, DESCR_COL.x + 1, y + 4.5);
    doc.text(item.um || '', col[2].x + 1, ty);
    doc.text(String(item.cantidad || ''), col[3].x + col[3].w - 1, ty, { align: 'right' });
    doc.text(fmt(item.importe_unitario), col[4].x + col[4].w - 1, ty, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(fmt(item.importe_total), col[5].x + col[5].w - 1, ty, { align: 'right' });

    y += ROW_H;
  });

  // Totales
  const TOTALS_H = 38 + (pdfAnticipo > 0 ? 8 : 0) + (pdfFondoReparo > 0 ? 8 : 0);
  if (y + TOTALS_H > SAFE_BOTTOM) {
    drawFooter(pageNum, '??');
    doc.addPage();
    pageNum++;
    drawPageHeader();
    y = 26;
  }
  y += 5;

  doc.setFillColor(235, 243, 255);
  doc.rect(W - M - 90, y, 90, 8, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(15, 28, 46);
  doc.text('SUBTOTAL:', W - M - 88, y + 5.5);
  doc.text(fmt(pdfSubtotal), W - M - 1, y + 5.5, { align: 'right' });
  y += 10;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(90, 90, 90);
  if (pdfAnticipo > 0) {
    doc.text(`Anticipo/Desacopio (${anticipo_pct}%):   -${fmt(pdfAnticipo)}`, W - M, y, { align: 'right' });
    y += 7;
  }
  if (pdfFondoReparo > 0) {
    doc.text(`Fondo de Reparo (${fondo_reparo_pct}%):   -${fmt(pdfFondoReparo)}`, W - M, y, { align: 'right' });
    y += 7;
  }

  doc.setFillColor(15, 28, 46);
  doc.rect(W - M - 90, y, 90, 10, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text('TOTAL NETO:', W - M - 88, y + 7);
  doc.text(fmt(pdfTotalNeto), W - M - 1, y + 7, { align: 'right' });

  // Footers finales
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(p, totalPages);
  }

  return doc.output('arraybuffer');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const forceRun = body.forceRun === true;

    // Fecha actual (Argentina UTC-3)
    const now = new Date();
    const argOffset = -3 * 60;
    const argNow = new Date(now.getTime() + (argOffset - now.getTimezoneOffset()) * 60000);
    const todayYear = argNow.getFullYear();
    const todayMonth = argNow.getMonth() + 1;
    const todayDay = argNow.getDate();

    // El último día hábil del mes ACTUAL es cuando se emiten los certificados del MES SIGUIENTE
    const lastBizDay = getLastBusinessDayOfMonth(todayYear, todayMonth);
    const isLastBizDay = todayDay === lastBizDay.getDate();

    if (!forceRun && !isLastBizDay) {
      return Response.json({
        shouldRun: false,
        message: `No es el último día hábil del mes. Próxima emisión automática: ${lastBizDay.toLocaleDateString('es-AR')}.`,
        nextRunDate: lastBizDay.toISOString().split('T')[0],
      });
    }

    // El certificado es para el MES SIGUIENTE
    let certYear = todayYear;
    let certMonth = todayMonth + 1;
    if (certMonth > 12) { certMonth = 1; certYear++; }
    const mesFormato = `${certYear}-${String(certMonth).padStart(2, '0')}`;
    const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const mesPeriodoLabel = `${MESES_ES[certMonth - 1]} ${certYear}`;

    // Obtener todos los AbonoMaestro activos
    const abonos = await base44.asServiceRole.entities.AbonoMaestro.filter({ estado: 'activo' });

    const generatedCerts = [];
    const skipped = [];

    for (const abono of abonos) {
      // Verificar que el mes a certificar esté dentro del período de vigencia
      if (abono.fecha_inicio_validez && abono.fecha_fin_validez) {
        const inicioDate = new Date(abono.fecha_inicio_validez + 'T00:00:00');
        const finDate = new Date(abono.fecha_fin_validez + 'T00:00:00');
        const certDate = new Date(`${certYear}-${String(certMonth).padStart(2, '0')}-01T00:00:00`);

        if (certDate < inicioDate || certDate > finDate) {
          skipped.push({ contratista: abono.contratista, reason: 'Mes fuera del período de vigencia del contrato' });
          continue;
        }
      }

      // Verificar idempotencia: no generar si ya existe para ese mes y abono
      const existing = await base44.asServiceRole.entities.Certificado.filter({
        oc_numero: abono.oc_numero || '__NONE__',
        mes_periodo: mesFormato,
        tipo: 'abono_mensual',
        generado_automaticamente: true
      });

      const existingPorContratista = !abono.oc_numero
        ? await base44.asServiceRole.entities.Certificado.filter({
            contratista: abono.contratista,
            mes_periodo: mesFormato,
            tipo: 'abono_mensual',
            generado_automaticamente: true
          })
        : [];

      if (existing.length > 0 || existingPorContratista.length > 0) {
        skipped.push({ contratista: abono.contratista, reason: 'Ya existe para este mes' });
        continue;
      }

      // Calcular el número de certificado DENTRO del contrato
      const inicioStr = abono.fecha_inicio_validez || `${certYear}-${String(certMonth).padStart(2, '0')}-01`;
      const [inicioY, inicioM] = inicioStr.split('-').map(Number);
      const diffMeses = (certYear - inicioY) * 12 + (certMonth - inicioM);
      const numeroEnContrato = diffMeses + 1;

      // Número global de certificado
      const allCerts = await base44.asServiceRole.entities.Certificado.filter({}, '-numero', 1);
      const lastNum = allCerts.length > 0 ? (allCerts[0].numero || 0) : 0;
      const certNumber = lastNum + 1;

      const fechaCert = lastBizDay.toISOString().split('T')[0];
      // Parsear montos correctamente (pueden venir como strings "1.234.567")
      const montoTotalContrato = parseMonto(abono.monto_total_contrato);
      const duracionMeses = Math.max(parseInt(abono.duracion_meses) || 1, 1);
      const montoMensual = parseMonto(abono.monto_mensual) || (montoTotalContrato / duracionMeses);

      // Usar ítems del contrato maestro si existen, sino generar ítem genérico
      const certItems = abono.items?.length
        ? abono.items.map((it, idx) => {
            const impUnit = parseMonto(it.importe_unitario);
            const cant = parseFloat(it.cantidad) || 1;
            const impTotal = parseMonto(it.importe_total) || (cant * impUnit);
            return {
              numero: idx + 1,
              descripcion: it.descripcion || `Abono mensual – ${mesPeriodoLabel}`,
              um: it.um || 'MES',
              cantidad: cant,
              importe_unitario: impUnit,
              importe_total: impTotal,
            };
          })
        : [{
            numero: 1,
            descripcion: `Abono mensual de mantenimiento – ${mesPeriodoLabel}`,
            um: 'MES',
            cantidad: 1,
            importe_unitario: montoMensual,
            importe_total: montoMensual,
          }];

      // Subtotal real basado en los ítems
      const subtotalReal = certItems.reduce((acc, it) => acc + (it.importe_total || 0), 0) || montoMensual;

      const newCert = {
        numero: certNumber,
        tipo: 'abono_mensual',
        estado: 'emitido',
        generado_automaticamente: true,
        contratista: abono.contratista,
        contratista_id: abono.created_by_id || '',
        emprendimiento: abono.emprendimiento || '',
        obra_servicio: abono.obra_servicio || '',
        ada_numero: abono.ada_numero || '',
        oc_numero: abono.oc_numero || '',
        mes_periodo: mesFormato,
        fecha_certificado: fechaCert,
        fecha_inicio: abono.fecha_inicio_validez || '',
        plazo_obra: abono.plazo_obra || 'Mensual',
        plazo_entrega: abono.plazo_entrega || '',
        condiciones_pago: abono.condiciones_pago || '',
        monto_contratado: montoTotalContrato,
        subtotal: subtotalReal,
        // Solo guardar porcentajes si fueron definidos explícitamente (> 0) en el abono maestro
        anticipo_pct: abono.anticipo_pct || 0,
        fondo_reparo_pct: abono.fondo_reparo_pct || 0,
        items: certItems,
        numero_en_contrato: numeroEnContrato,
        duracion_meses_total: abono.duracion_meses,
      };

      // Generar y subir PDF profesional
      let pdfUrl = '';
      try {
        const pdfBuffer = await generateCertificatePDF(newCert);
        const uploadRes = await base44.integrations.Core.UploadFile({ file: pdfBuffer });
        pdfUrl = uploadRes.file_url;
      } catch (e) {
        console.log('PDF upload error:', e.message);
      }

      newCert.pdf_url = pdfUrl;

      // Guardar el certificado
      const created = await base44.asServiceRole.entities.Certificado.create(newCert);

      // Actualizar el contador de certificados emitidos en AbonoMaestro
      const nuevosEmitidos = (abono.certificados_emitidos || 0) + 1;
      const nuevoEstado = nuevosEmitidos >= abono.duracion_meses ? 'completado' : 'activo';
      await base44.asServiceRole.entities.AbonoMaestro.update(abono.id, {
        certificados_emitidos: nuevosEmitidos,
        estado: nuevoEstado,
      });

      generatedCerts.push({
        id: created.id,
        numero: certNumber,
        numero_en_contrato: numeroEnContrato,
        contratista: abono.contratista,
        mes: mesFormato,
        monto: subtotalReal,
        pdf_url: pdfUrl
      });
    }

    return Response.json({
      success: true,
      message: `Emisión para ${mesPeriodoLabel}: ${generatedCerts.length} certificados generados, ${skipped.length} omitidos.`,
      generatedCertificates: generatedCerts,
      skipped,
      mesPeriodo: mesFormato,
      executionDate: argNow.toLocaleDateString('es-AR')
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});