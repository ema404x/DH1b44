import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import jsPDF from 'npm:jspdf@4.0.0';

// Feriados fijos argentinos
const FERIADOS_FIJOS = [
  { month: 1, day: 1 },   // Año Nuevo
  { month: 3, day: 24 },  // Día de la Memoria
  { month: 4, day: 2 },   // Veteranos de Malvinas
  { month: 5, day: 1 },   // Día del Trabajo
  { month: 5, day: 25 },  // Revolución de Mayo
  { month: 6, day: 20 },  // Paso a la Inmortalidad de Belgrano
  { month: 7, day: 9 },   // Independencia
  { month: 8, day: 17 },  // Paso a la Inmortalidad de San Martín
  { month: 10, day: 12 }, // Día del Respeto a la Diversidad Cultural
  { month: 11, day: 20 }, // Día de la Soberanía Nacional
  { month: 12, day: 8 },  // Inmaculada Concepción
  { month: 12, day: 25 }, // Navidad
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
    doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text('en mantenimiento, obras y servicios', M, 16);
  }
  doc.setFontSize(12); doc.setFont('helvetica', 'bold');
  doc.text(`CERTIFICADO DE ABONO MENSUAL N° ${certificado.numero}`, W - M, 10, { align: 'right' });
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
  doc.setFont('helvetica', 'bold'); doc.text('ADA N°:', W / 2, y);
  doc.setFont('helvetica', 'normal'); doc.text(certificado.ada_numero || '—', W / 2 + 18, y);
  y += 12;

  if (certificado.items && certificado.items.length > 0) {
    doc.setFillColor(15, 28, 46); doc.rect(M, y, W - M * 2, 6, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(6); doc.setFont('helvetica', 'bold');
    doc.text('N°', M + 2, y + 4);
    doc.text('DESCRIPCIÓN', M + 10, y + 4);
    doc.text('UM', M + 120, y + 4);
    doc.text('CANTIDAD', M + 135, y + 4);
    doc.text('P. UNITARIO', M + 158, y + 4);
    doc.text('IMPORTE TOTAL', M + 185, y + 4);
    y += 7;

    doc.setTextColor(50, 50, 50); doc.setFont('helvetica', 'normal');
    certificado.items.forEach((item, i) => {
      if (y > 178) { doc.addPage(); y = 15; }
      if (i % 2 === 0) { doc.setFillColor(247, 247, 247); doc.rect(M, y - 1, W - M * 2, 5.5, 'F'); }
      doc.setFontSize(5.5);
      doc.text(String(i + 1), M + 2, y + 3);
      doc.text(doc.splitTextToSize(item.descripcion || '', 105)[0], M + 10, y + 3);
      doc.text(item.um || '', M + 120, y + 3);
      doc.text(String(item.cantidad || ''), M + 135, y + 3);
      doc.text(`$${(item.importe_unitario || 0).toLocaleString('es-AR')}`, M + 158, y + 3);
      doc.setFont('helvetica', 'bold');
      doc.text(`$${(item.importe_total || 0).toLocaleString('es-AR')}`, M + 185, y + 3);
      doc.setFont('helvetica', 'normal');
      y += 5.5;
    });

    y += 4;
    const subtotal = certificado.subtotal || 0;
    doc.setFillColor(230, 240, 255); doc.rect(W - M - 80, y, 80, 5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(15, 28, 46);
    doc.text('SUBTOTAL:', W - M - 78, y + 3.5);
    doc.text(`$${subtotal.toLocaleString('es-AR')}`, W - M - 1, y + 3.5, { align: 'right' });
  }

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
        message: `No es el último día hábil del mes. Próxima emisión automática: ${lastBizDay.toLocaleDateString('es-AR')} (para el mes siguiente).`,
        nextRunDate: lastBizDay.toISOString().split('T')[0],
      });
    }

    // El certificado es para el MES SIGUIENTE
    let certYear = todayYear;
    let certMonth = todayMonth + 1;
    if (certMonth > 12) { certMonth = 1; certYear++; }
    const mesFormato = `${certYear}-${String(certMonth).padStart(2, '0')}`;

    // Buscar clientes activos con abono_mensual activo
    const clients = await base44.asServiceRole.entities.Client.filter({ status: 'activo' });

    const generatedCerts = [];
    const skipped = [];

    for (const client of clients) {
      // Verificar idempotencia: no generar si ya existe para ese mes
      const existing = await base44.asServiceRole.entities.Certificado.filter({
        contratista_id: client.id,
        mes_periodo: mesFormato,
        tipo: 'abono_mensual',
        generado_automaticamente: true
      });

      if (existing.length > 0) {
        skipped.push({ contratista: client.name, reason: 'Ya existe para este mes' });
        continue;
      }

      // Obtener último número de certificado
      const allCerts = await base44.asServiceRole.entities.Certificado.filter({}, '-numero', 1);
      const lastNum = allCerts.length > 0 ? (allCerts[0].numero || 0) : 0;
      const certNumber = lastNum + 1;

      const fechaCert = lastBizDay.toISOString().split('T')[0];

      const newCert = {
        numero: certNumber,
        tipo: 'abono_mensual',
        estado: 'emitido',
        generado_automaticamente: true,
        contratista: client.name,
        contratista_id: client.id,
        emprendimiento: client.notes || '',
        mes_periodo: mesFormato,
        fecha_certificado: fechaCert,
        items: [],
        subtotal: 0,
        anticipo_pct: 0,
        fondo_reparo_pct: 5,
      };

      // Intentar generar y subir PDF
      let pdfUrl = '';
      try {
        const pdfBuffer = await generateCertificatePDF(newCert);
        const uploadRes = await base44.integrations.Core.UploadFile({ file: pdfBuffer });
        pdfUrl = uploadRes.file_url;
      } catch (e) {
        console.log('PDF upload error:', e.message);
      }

      newCert.pdf_url = pdfUrl;
      const created = await base44.asServiceRole.entities.Certificado.create(newCert);

      generatedCerts.push({
        id: created.id,
        numero: certNumber,
        contratista: client.name,
        mes: mesFormato,
        pdf_url: pdfUrl
      });
    }

    return Response.json({
      success: true,
      message: `Emisión para ${mesFormato}: ${generatedCerts.length} certificados generados, ${skipped.length} omitidos.`,
      generatedCertificates: generatedCerts,
      skipped,
      mesPeriodo: mesFormato,
      executionDate: argNow.toLocaleDateString('es-AR')
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});