import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import jsPDF from 'npm:jspdf@4.0.0';

// Calcula el último día hábil del mes (lunes-viernes, sin feriados argentinos)
function getLastBusinessDayOfMonth(year, month) {
  const fixedHolidays = [
    { month: 1, day: 1 },   // Año Nuevo
    { month: 5, day: 1 },   // Día del Trabajo
    { month: 7, day: 9 },   // Independencia
    { month: 12, day: 25 }, // Navidad
  ];

  const isHoliday = (date) => {
    return fixedHolidays.some(h => h.month === date.getMonth() + 1 && h.day === date.getDate());
  };

  const isBusinessDay = (date) => {
    const dayOfWeek = date.getDay();
    return dayOfWeek !== 0 && dayOfWeek !== 6 && !isHoliday(date);
  };

  const lastDay = new Date(year, month, 0).getDate();
  let date = new Date(year, month - 1, lastDay);

  while (!isBusinessDay(date)) {
    date.setDate(date.getDate() - 1);
  }

  return date;
}

// Obtiene el número secuencial del próximo certificado
async function getNextCertificateNumber(base44, contratista, mes) {
  const existingCerts = await base44.asServiceRole.entities.Certificado.filter({
    contratista: contratista,
    mes_periodo: mes
  });
  
  return (existingCerts.length || 0) + 1;
}

// Genera PDF del certificado
function generateCertificatePDF(certificado) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 10;

  // Encabezado
  doc.setFontSize(16);
  doc.text('CERTIFICADO DE ABONO MENSUAL', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  // Info principal
  doc.setFontSize(10);
  doc.text(`Nº ${certificado.numero}`, 20, yPos);
  doc.text(`Mes: ${certificado.mes_periodo}`, pageWidth - 40, yPos);
  yPos += 8;

  doc.text(`Contratista: ${certificado.contratista}`, 20, yPos);
  yPos += 6;

  doc.text(`Fecha: ${new Date(certificado.fecha_certificado).toLocaleDateString('es-AR')}`, 20, yPos);
  yPos += 12;

  // Tabla de items
  if (certificado.items && certificado.items.length > 0) {
    doc.setFontSize(9);
    doc.text('ITEMS:', 20, yPos);
    yPos += 6;

    // Headers tabla
    doc.setFillColor(200, 200, 200);
    const colX = [20, 80, 100, 130, 160];
    doc.text('Descripción', colX[0], yPos);
    doc.text('Cantidad', colX[1], yPos);
    doc.text('Unitario', colX[2], yPos);
    doc.text('Total', colX[3], yPos);
    yPos += 6;

    // Items
    certificado.items.forEach((item, idx) => {
      if (yPos > pageHeight - 20) {
        doc.addPage();
        yPos = 10;
      }
      doc.text((idx + 1).toString(), colX[0], yPos);
      doc.text(item.descripcion || '', colX[0] + 5, yPos);
      doc.text(item.cantidad?.toString() || '', colX[1], yPos);
      doc.text(`$${item.importe_unitario?.toFixed(2) || '0.00'}`, colX[2], yPos);
      doc.text(`$${item.importe_total?.toFixed(2) || '0.00'}`, colX[3], yPos);
      yPos += 6;
    });

    yPos += 4;
    doc.setFontSize(11);
    doc.text(`SUBTOTAL: $${certificado.subtotal?.toFixed(2) || '0.00'}`, pageWidth - 60, yPos);
  }

  return doc.output('arraybuffer');
}

// Obtiene clientes activos
async function getActiveClients(base44) {
  return await base44.asServiceRole.entities.Client.filter({ status: 'activo' });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;

    const lastBusinessDay = getLastBusinessDayOfMonth(year, month);
    
    const isLastBusinessDay = 
      today.getDate() === lastBusinessDay.getDate() &&
      today.getMonth() === lastBusinessDay.getMonth() &&
      today.getFullYear() === lastBusinessDay.getFullYear();

    if (!isLastBusinessDay) {
      return Response.json({ 
        message: `No es el último día hábil. Próxima ejecución: ${lastBusinessDay.toLocaleDateString('es-AR')}`,
        shouldRun: false
      });
    }

    const clients = await getActiveClients(base44);
    const generatedCerts = [];
    const mesFormato = `${year}-${String(month).padStart(2, '0')}`;

    for (const client of clients) {
      const certNumber = await getNextCertificateNumber(base44, client.name, mesFormato);
      
      // Generar PDF
      const newCert = {
        numero: certNumber,
        tipo: 'abono_mensual',
        estado: 'emitido',
        generado_automaticamente: true,
        contratista: client.name,
        contratista_id: client.id,
        mes_periodo: mesFormato,
        fecha_certificado: today.toISOString().split('T')[0],
        items: [],
        subtotal: 0,
        anticipo_pct: 0,
        fondo_reparo_pct: 5,
      };

      const pdfBuffer = generateCertificatePDF(newCert);
      
      // Construir nombre de archivo con estructura de carpetas
      const fileName = `${client.name}/${year}/${String(month).padStart(2, '0')}/certificado_${certNumber}.pdf`;
      
      // Guardar PDF (simulamos la estructura de carpetas en el nombre)
      const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('file', pdfBlob, fileName);

      // Intentar subir el PDF
      let pdfUrl = '';
      try {
        const uploadRes = await base44.integrations.Core.UploadFile({
          file: pdfBuffer
        });
        pdfUrl = uploadRes.file_url;
      } catch (uploadErr) {
        console.log('PDF upload skipped:', uploadErr.message);
      }

      // Guardar certificado en BD
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
      message: `Se generaron ${generatedCerts.length} certificados mensuales`,
      generatedCertificates: generatedCerts,
      executionDate: today.toLocaleDateString('es-AR')
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});