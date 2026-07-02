import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import jsPDF from 'npm:jspdf@4.0.0';

const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const parseMonto = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  const clean = String(v).replace(/\./g, '').replace(',', '.');
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
};

const fmt = (v) => {
  const n = typeof v === 'number' ? v : parseMonto(v);
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

const LOGO_URL = 'https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/b6844473f_mejores_cover.jpg';

async function loadLogoBase64() {
  try {
    const res = await fetch(LOGO_URL);
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return 'data:image/jpeg;base64,' + btoa(binary);
  } catch { return null; }
}

async function generateCertificatePDF(certificado, logoBase64) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297, H = 210, M = 10, C = W - M * 2;
  const FOOTER_H = 10;
  const SAFE_BOTTOM = H - FOOTER_H - 5;

  const allItems = certificado.items || [];
  const subtotalContrato = allItems.reduce((acc, it) => {
    return acc + (parseMonto(it.importe_total) || (parseMonto(it.cantidad) * parseMonto(it.importe_unitario)) || 0);
  }, 0);

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
    doc.text(`ABONO MENSUAL · ${fmtDate(certificado.fecha_certificado)}`, W - M, 17, { align: 'right' });
  };

  const drawFooter = (pageNum, totalPages) => {
    doc.setFillColor(15, 28, 46);
    doc.rect(0, H - FOOTER_H, W, FOOTER_H, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Av. Cordoba 1351 1 Piso · (C1055AAD) CABA · Tel 4816-0111 · www.mejores.ar', M, H - 3.5);
    doc.text(`CERT N° ${certificado.numero} · Pag ${pageNum}/${totalPages}`, W - M, H - 3.5, { align: 'right' });
  };

  const TABLE_COLS = (() => {
    const defs = [
      { w: 7,   label: 'N°',         align: 'right' },
      { w: 100, label: 'DESCRIPCION', align: 'left'  },
      { w: 12,  label: 'UM',         align: 'left'   },
      { w: 14,  label: 'CANT.',      align: 'right'  },
      { w: 30,  label: 'IMP. UNIT.', align: 'right'  },
      { w: 34,  label: 'IMP. TOTAL', align: 'right'  },
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

  drawPageHeader();
  let y = 26;
  let pageNum = 1;

  const leftInfo = [
    ['EMPRENDIMIENTO', certificado.emprendimiento],
    ['OBRA / SERVICIO', certificado.obra_servicio],
    ['CONTRATISTA', certificado.contratista],
  ];
  const rightInfo = [
    ['ADA N°', certificado.ada_numero],
    ['OC N°', certificado.oc_numero || '—'],
    ['MES / PERIODO', certificado.mes_periodo],
    ['FECHA INICIO', fmtDate(certificado.fecha_inicio)],
    ['PLAZO', certificado.plazo_obra || '—'],
    ['MONTO CONTRATADO', fmt(montoContratado)],
  ];

  const INFO_LINE = 5.5;
  doc.setFontSize(8);
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

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(p, totalPages);
  }

  return doc.output('arraybuffer');
}

// ── Helpers compartidos ──────────────────────────────────────────────────

function resolveInicioMes(abono) {
  let inicioYear, inicioMonth;
  if (abono.fecha_inicio_validez) {
    [inicioYear, inicioMonth] = abono.fecha_inicio_validez.split('-').map(Number);
  } else if (abono.fecha_oc_emision) {
    const [y, m] = abono.fecha_oc_emision.split('-').map(Number);
    inicioMonth = m + 1; inicioYear = y;
    if (inicioMonth > 12) { inicioMonth = 1; inicioYear++; }
  } else {
    const now = new Date();
    inicioMonth = now.getMonth() + 2; inicioYear = now.getFullYear();
    if (inicioMonth > 12) { inicioMonth = 1; inicioYear++; }
  }
  return { inicioYear, inicioMonth };
}

function calcMesLabel(inicioYear, inicioMonth, offset) {
  let m = inicioMonth + offset;
  let y = inicioYear;
  while (m > 12) { m -= 12; y++; }
  return {
    mesFormato: `${y}-${String(m).padStart(2, '0')}`,
    mesLabel: `${MESES_ES[m - 1]} ${y}`,
  };
}

// Crea UN certificado para el mes dado (monthIndex 0-based dentro del contrato)
async function generateOneCertificate(base44, abono, monthIndex, logoBase64, currentNum) {
  const { inicioYear, inicioMonth } = resolveInicioMes(abono);
  const { mesFormato, mesLabel } = calcMesLabel(inicioYear, inicioMonth, monthIndex);

  const duracionMeses = Math.max(parseInt(abono.duracion_meses) || 1, 1);
  const montoTotalContrato = parseMonto(abono.monto_total_contrato);
  const montoMensual = parseMonto(abono.monto_mensual) || (montoTotalContrato / duracionMeses);

  const numero = currentNum + 1;
  const numeroEnContrato = monthIndex + 1;

  const certItems = abono.items?.length
    ? abono.items.map((it, idx) => ({
        numero: idx + 1,
        descripcion: it.descripcion || `Abono mensual – ${mesLabel}`,
        um: it.um || 'MES',
        cantidad: parseFloat(it.cantidad) || 1,
        importe_unitario: parseMonto(it.importe_unitario),
        importe_total: parseMonto(it.importe_total) || (parseFloat(it.cantidad) || 1) * parseMonto(it.importe_unitario),
      }))
    : [{
        numero: 1,
        descripcion: `Abono mensual de mantenimiento – ${mesLabel}`,
        um: 'MES',
        cantidad: 1,
        importe_unitario: montoMensual,
        importe_total: montoMensual,
      }];

  const subtotalReal = certItems.reduce((acc, it) => acc + (it.importe_total || 0), 0) || montoMensual;
  const todayStr = new Date().toISOString().split('T')[0];

  const newCert = {
    numero,
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
    fecha_certificado: todayStr,
    fecha_inicio: abono.fecha_inicio_validez || '',
    plazo_obra: abono.plazo_obra || 'Mensual',
    plazo_entrega: abono.plazo_entrega || '',
    condiciones_pago: abono.condiciones_pago || '',
    monto_contratado: montoTotalContrato,
    subtotal: subtotalReal,
    anticipo_pct: abono.anticipo_pct || 0,
    fondo_reparo_pct: abono.fondo_reparo_pct || 0,
    items: certItems,
    numero_en_contrato: numeroEnContrato,
    duracion_meses_total: duracionMeses,
  };

  try {
    const pdfBuffer = await generateCertificatePDF(newCert, logoBase64);
    const uploadRes = await base44.integrations.Core.UploadFile({ file: pdfBuffer });
    newCert.pdf_url = uploadRes.file_url;
  } catch (e) {
    console.log('PDF error:', e.message);
  }

  const created = await base44.asServiceRole.entities.Certificado.create(newCert);

  return {
    generated: true,
    nextNum: numero,
    id: created.id,
    numero,
    numero_en_contrato: numeroEnContrato,
    mes: mesLabel,
    monto: subtotalReal,
    pdf_url: newCert.pdf_url,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { abono_id, regenerar = false, modo } = body;

    // ════════════════════════════════════════════════════════════════════
    // MODO MENSUAL: Generar el certificado del mes para TODOS los abonos activos
    // ════════════════════════════════════════════════════════════════════
    if (modo === 'mensual_todos') {
      const abonos = await base44.asServiceRole.entities.AbonoMaestro.filter({ estado: 'activo' });
      const logoBase64 = await loadLogoBase64();

      // Obtener ultimo numero de certificado global (auto-incremental)
      const lastCerts = await base44.asServiceRole.entities.Certificado.filter({}, '-numero', 1);
      let currentNum = lastCerts.length > 0 ? (lastCerts[0].numero || 0) : 0;

      const results = [];
      let totalGenerated = 0;
      let totalSkipped = 0;

      for (const abono of abonos) {
        const duracionMeses = Math.max(parseInt(abono.duracion_meses) || 1, 1);

        // Contar certificados ya generados para este abono
        const existingCerts = await base44.asServiceRole.entities.Certificado.filter({
          ada_numero: abono.ada_numero || '',
          tipo: 'abono_mensual',
          generado_automaticamente: true,
        });
        const monthIndex = existingCerts.length;

        // Si ya se completaron todos los meses del contrato
        if (monthIndex >= duracionMeses) {
          await base44.asServiceRole.entities.AbonoMaestro.update(abono.id, {
            estado: 'completado',
            lote_generado: true,
            certificados_emitidos: monthIndex,
          });
          results.push({ contratista: abono.contratista, skipped: true, reason: 'Contrato completado', mes: '—' });
          totalSkipped++;
          continue;
        }

        try {
          const res = await generateOneCertificate(base44, abono, monthIndex, logoBase64, currentNum);
          currentNum = res.nextNum;
          totalGenerated++;

          // Actualizar el abono
          const newCount = monthIndex + 1;
          const completado = newCount >= duracionMeses;
          await base44.asServiceRole.entities.AbonoMaestro.update(abono.id, {
            certificados_emitidos: newCount,
            lote_generado: true,
            estado: completado ? 'completado' : 'activo',
          });

          results.push({
            contratista: abono.contratista,
            generated: true,
            numero: res.numero,
            mes: res.mes,
            monto: res.monto,
            pdf_url: res.pdf_url,
          });
        } catch (e) {
          results.push({ contratista: abono.contratista, error: e.message });
          totalSkipped++;
        }
      }

      return Response.json({
        success: true,
        message: `Generación mensual: ${totalGenerated} certificados generados, ${totalSkipped} omitidos`,
        total_abonos: abonos.length,
        generated: totalGenerated,
        skipped: totalSkipped,
        results,
      });
    }

    // ════════════════════════════════════════════════════════════════════
    // MODO LOTE: Generar todos los certificados de un abono (existente)
    // ════════════════════════════════════════════════════════════════════
    if (!abono_id) {
      return Response.json({ error: 'abono_id es requerido' }, { status: 400 });
    }

    const abono = await base44.asServiceRole.entities.AbonoMaestro.get(abono_id);
    if (!abono) {
      return Response.json({ error: 'Abono no encontrado' }, { status: 404 });
    }

    if (abono.lote_generado && !regenerar) {
      return Response.json({
        error: 'El lote ya fue generado. Usá regenerar=true para recrear los certificados.'
      }, { status: 400 });
    }

    const duracionMeses = Math.max(parseInt(abono.duracion_meses) || 1, 1);
    const { inicioYear, inicioMonth } = resolveInicioMes(abono);

    const existingCerts = await base44.asServiceRole.entities.Certificado.filter({
      ada_numero: abono.ada_numero || '',
      tipo: 'abono_mensual',
    });
    const existingMeses = new Set(existingCerts.map(c => c.mes_periodo));

    if (regenerar && existingCerts.length > 0) {
      for (const c of existingCerts) {
        if (c.generado_automaticamente) {
          await base44.asServiceRole.entities.Certificado.delete(c.id);
        }
      }
      existingMeses.clear();
    }

    const logoBase64 = await loadLogoBase64();

    const lastCerts = await base44.asServiceRole.entities.Certificado.filter({}, '-numero', 1);
    let currentNum = lastCerts.length > 0 ? (lastCerts[0].numero || 0) : 0;

    const generated = [];
    const skipped = [];

    for (let i = 0; i < duracionMeses; i++) {
      const { mesFormato, mesLabel } = calcMesLabel(inicioYear, inicioMonth, i);

      if (existingMeses.has(mesFormato)) {
        skipped.push({ mes: mesLabel, reason: 'Ya existe' });
        continue;
      }

      const res = await generateOneCertificate(base44, abono, i, logoBase64, currentNum);
      currentNum = res.nextNum;
      generated.push({
        id: res.id,
        numero: res.numero,
        numero_en_contrato: res.numero_en_contrato,
        mes: res.mes,
        monto: res.monto,
        pdf_url: res.pdf_url,
      });
    }

    await base44.asServiceRole.entities.AbonoMaestro.update(abono_id, {
      lote_generado: true,
      certificados_emitidos: generated.length,
      estado: generated.length >= duracionMeses ? 'completado' : 'activo',
    });

    return Response.json({
      success: true,
      message: `Lote generado: ${generated.length} certificados para ${abono.contratista}`,
      contratista: abono.contratista,
      totalMeses: duracionMeses,
      generated,
      skipped,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});