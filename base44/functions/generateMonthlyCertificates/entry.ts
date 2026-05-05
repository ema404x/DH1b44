import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
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
  const W = 297, M = 10;

  doc.setFillColor(15, 28, 46);
  doc.rect(0, 0, W, 22, 'F');
  if (logoBase64) {
    doc.addImage(logoBase64, 'JPEG', M, 1, 50, 19);
  } else {
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('MEJORES', M, 10);
  }
  doc.setFontSize(12); doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(`CERTIFICADO DE ABONO MENSUAL N° ${certificado.numero_en_contrato} (${certificado.numero})`, W - M, 10, { align: 'right' });
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.text(`Mes: ${certificado.mes_periodo} · Fecha: ${certificado.fecha_certificado}`, W - M, 16, { align: 'right' });

  let y = 30;
  doc.setTextColor(60, 60, 60); doc.setFontSize(8);
  doc.setFont('helvetica', 'bold'); doc.text('CONTRATISTA:', M, y);
  doc.setFont('helvetica', 'normal'); doc.text(certificado.contratista || '—', M + 30, y);
  doc.setFont('helvetica', 'bold'); doc.text('EMPRENDIMIENTO:', W / 2, y);
  doc.setFont('helvetica', 'normal'); doc.text(certificado.emprendimiento || '—', W / 2 + 35, y);
  y += 8;
  doc.setFont('helvetica', 'bold'); doc.text('OBRA / SERVICIO:', M, y);
  doc.setFont('helvetica', 'normal'); doc.text(certificado.obra_servicio || '—', M + 30, y);
  doc.setFont('helvetica', 'bold'); doc.text('OC N°:', W / 2, y);
  doc.setFont('helvetica', 'normal'); doc.text(certificado.oc_numero || '—', W / 2 + 18, y);
  y += 8;
  doc.setFont('helvetica', 'bold'); doc.text('ADA N°:', M, y);
  doc.setFont('helvetica', 'normal'); doc.text(certificado.ada_numero || '—', M + 18, y);
  doc.setFont('helvetica', 'bold'); doc.text('CERTIFICADO:', W / 2, y);
  doc.setFont('helvetica', 'normal'); doc.text(`${certificado.numero_en_contrato} de ${certificado.duracion_meses_total}`, W / 2 + 25, y);
  y += 14;

  // Item único: el abono mensual
  doc.setFillColor(15, 28, 46); doc.rect(M, y, W - M * 2, 6, 'F');
  doc.setTextColor(255, 255, 255); doc.setFontSize(6.5); doc.setFont('helvetica', 'bold');
  doc.text('DESCRIPCIÓN', M + 5, y + 4);
  doc.text('UM', M + 160, y + 4);
  doc.text('CANTIDAD', M + 180, y + 4);
  doc.text('IMPORTE', W - M - 5, y + 4, { align: 'right' });
  y += 8;

  doc.setFillColor(247, 247, 247); doc.rect(M, y - 1, W - M * 2, 8, 'F');
  doc.setTextColor(50, 50, 50); doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
  doc.text(`Abono mensual de mantenimiento – ${certificado.mes_periodo}`, M + 5, y + 4);
  doc.text('MES', M + 160, y + 4);
  doc.text('1', M + 185, y + 4);
  doc.setFont('helvetica', 'bold');
  doc.text(`$${(certificado.subtotal || 0).toLocaleString('es-AR')}`, W - M - 5, y + 4, { align: 'right' });
  y += 12;

  // Subtotal
  doc.setFillColor(230, 240, 255); doc.rect(W - M - 80, y, 80, 6, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(15, 28, 46);
  doc.text('IMPORTE DEL CERTIFICADO:', W - M - 78, y + 4);
  doc.text(`$${(certificado.subtotal || 0).toLocaleString('es-AR')}`, W - M - 1, y + 4, { align: 'right' });

  // Footer
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFillColor(15, 28, 46); doc.rect(0, 197, W, 8, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(6); doc.setFont('helvetica', 'normal');
    doc.text('Av. Córdoba 1351 1°Piso · (C1055AAD) Ciudad Aut. de Bs. As. · Tel 4816-0111 · www.mejores.ar', M, 202);
    doc.text(`CERT N° ${certificado.numero} · Pág ${p}/${pages}`, W - M, 202, { align: 'right' });
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

      // También verificar por contratista si no hay OC
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
      const inicioDate = new Date((abono.fecha_inicio_validez || `${certYear}-${String(certMonth).padStart(2, '0')}-01`) + 'T00:00:00');
      const certDate = new Date(`${certYear}-${String(certMonth).padStart(2, '0')}-01T00:00:00`);
      const diffMeses = Math.round((certDate - inicioDate) / (1000 * 60 * 60 * 24 * 30.44));
      const numeroEnContrato = diffMeses + 1;

      // Número global de certificado
      const allCerts = await base44.asServiceRole.entities.Certificado.filter({}, '-numero', 1);
      const lastNum = allCerts.length > 0 ? (allCerts[0].numero || 0) : 0;
      const certNumber = lastNum + 1;

      const fechaCert = lastBizDay.toISOString().split('T')[0];
      const montoMensual = abono.monto_mensual || (abono.monto_total_contrato / abono.duracion_meses);

      // Usar ítems del contrato maestro si existen, sino generar ítem genérico
      const certItems = abono.items?.length
        ? abono.items.map((it, idx) => ({
            numero: idx + 1,
            descripcion: it.descripcion || `Abono mensual – ${mesPeriodoLabel}`,
            um: it.um || 'MES',
            cantidad: it.cantidad || 1,
            importe_unitario: it.importe_unitario || 0,
            importe_total: it.importe_total || (it.cantidad * it.importe_unitario) || 0,
          }))
        : [{
            numero: 1,
            descripcion: `Abono mensual de mantenimiento – ${mesPeriodoLabel}`,
            um: 'MES',
            cantidad: 1,
            importe_unitario: montoMensual,
            importe_total: montoMensual,
          }];

      const newCert = {
        numero: certNumber,
        tipo: 'abono_mensual',
        estado: 'emitido',
        generado_automaticamente: true,
        contratista: abono.contratista,
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
        monto_contratado: abono.monto_total_contrato,
        subtotal: montoMensual,
        anticipo_pct: abono.anticipo_pct || 0,
        fondo_reparo_pct: abono.fondo_reparo_pct || 0,
        items: certItems,
        // Campos extra para el PDF
        numero_en_contrato: numeroEnContrato,
        duracion_meses_total: abono.duracion_meses,
      };

      // Generar y subir PDF
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
        monto: montoMensual,
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