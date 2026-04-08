import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import ExcelJS from 'npm:exceljs@4.4.0';
import { Readable } from 'https://deno.land/std@0.208.0/streams/mod.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { certificadoData, format } = await req.json();
    const data = certificadoData;

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(`CERTIFICADO Nº ${data.numero}`);

      // Cargar logo de Mejores
      let logoId = null;
      try {
        const logoRes = await fetch('https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/b6844473f_mejores_cover.jpg');
        const logoBuffer = await logoRes.arrayBuffer();
        logoId = workbook.addImage({ buffer: logoBuffer, extension: 'jpeg' });
      } catch {}

      // Configurar ancho de columnas
      sheet.getColumn(1).width = 8;   // ITEM
      sheet.getColumn(2).width = 30;  // DESCRIPCION
      sheet.getColumn(3).width = 8;   // UM
      sheet.getColumn(4).width = 10;  // CANTIDAD
      sheet.getColumn(5).width = 12;  // IMPORTE UNITARIO
      sheet.getColumn(6).width = 12;  // IMPORTE TOTAL
      for (let i = 7; i <= 14; i++) sheet.getColumn(i).width = 11;

      // Fila 1 para el logo (altura 60px)
      let row = 1;
      sheet.getRow(row).height = 60;
      sheet.mergeCells(`A${row}:N${row}`);
      if (logoId !== null) {
        sheet.addImage(logoId, {
          tl: { col: 0, row: 0 },
          ext: { width: 220, height: 55 },
          editAs: 'oneCell',
        });
      }
      row++;

      const addRow = (text, merged = true) => {
        const r = sheet.addRow([text]);
        if (merged) sheet.mergeCells(`A${row}:N${row}`);
        r.font = { bold: true, size: 11 };
        r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
        r.alignment = { wrapText: true, vertical: 'center', horizontal: 'left' };
        sheet.getRow(row).height = 25;
        row++;
      };

      // Header
      addRow(`EMPRENDIMIENTO: ${data.emprendimiento}`);
      addRow(`OBRA / SERVICIO: ${data.obra_servicio}`);
      addRow(`CONTRATISTA: ${data.contratista}`);
      addRow(`ADA Nº: ${data.ada_numero}`);
      addRow(`OC N°: ${data.oc_numero || '—'}`);
      addRow(`CERTIFICADO N° ${data.numero}`);
      addRow(`MES / PERÍODO ${data.mes_periodo || '—'}`);
      row++;
      addRow(`FECHA DE INICIO: ${data.fecha_inicio || '—'}`);
      addRow(`PLAZO DE OBRA: ${data.plazo_obra || '—'}`);
      addRow(`FECHA DE FINALIZACION: ${data.fecha_finalizacion || '—'}`);
      
      const r = sheet.addRow([`MONTO CONTRATADO: $${(data.monto_contratado || 0).toLocaleString('es-AR')}`, '', '', '', '', '', '', '', '', '', '', '', 'FECHA:', new Date().toLocaleDateString('es-AR')]);
      r.font = { bold: true };
      r.alignment = { wrapText: true, vertical: 'center' };
      sheet.getRow(row).height = 20;
      row++;
      
      addRow(`BASE: ${data.base || '—'}`);
      row++;

      // Headers de tabla
      const headerRow = sheet.addRow([
        'ITEM', 'DESCRIPCION', 'UM', 'CANTIDAD', 'IMPORTE\nUNITARIO', 'IMPORTE\nTOTAL',
        'MEDICION ACUMULADA ANTERIOR', '', 'MEDICION PRESENTE', '', 'MEDICION ACUMULADA PRESENTE', '', 'SALDO PENDIENTE', ''
      ]);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F1C2E' } };
      headerRow.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
      sheet.getRow(row).height = 35;
      row++;

      const subHeaderRow = sheet.addRow(['', '', '', '', '', '', 'Unidad', 'Importe', 'Unidad', 'Importe', 'Unidad', 'Importe', 'Unidad', 'Importe']);
      subHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
      subHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F1C2E' } };
      subHeaderRow.alignment = { horizontal: 'center', vertical: 'center' };
      sheet.getRow(row).height = 20;
      row++;

      const subtotal = data.items.reduce((acc, it) => acc + (it.importe_total || 0), 0);
      const anticipo = subtotal * (data.anticipo_pct / 100);
      const totalNeto = subtotal - anticipo;

      // Items
      (data.items || []).forEach((item) => {
       const itemRow = sheet.addRow([
         item.numero, item.descripcion, item.um, item.cantidad,
         item.importe_unitario, item.importe_total,
         item.med_acum_anterior_unidad || 0, item.med_acum_anterior_importe || 0,
         item.med_presente_unidad || 0, item.med_presente_importe || 0,
         item.med_acum_presente_unidad || 0, item.med_acum_presente_importe || 0,
         item.saldo_pendiente_unidad || 0, item.saldo_pendiente_importe || 0,
       ]);
       itemRow.alignment = { horizontal: 'right', wrapText: true, vertical: 'center' };
       itemRow.font = { size: 10 };
       sheet.getRow(row).height = 25;
       if (row % 2 === 0) itemRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
       row++;
      });

      // Totales
      const totalRow = sheet.addRow(['', 'TOTAL (en Pesos)', '', '', '', subtotal, '', 0, '', subtotal, '', subtotal, '', totalNeto]);
      totalRow.font = { bold: true, size: 11 };
      totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCC99' } };
      totalRow.alignment = { wrapText: true, vertical: 'center' };
      sheet.getRow(row).height = 22;
      row += 2;

      const facturarRow = sheet.addRow(['', 'TOTAL A FACTURAR', '', '', '', '', '', '', '', subtotal]);
      facturarRow.font = { bold: true, size: 11 };
      facturarRow.alignment = { wrapText: true, vertical: 'center' };
      sheet.getRow(row).height = 20;
      row++;

      const desaccopioRow = sheet.addRow(['', `DESACOPIO ( NOTA DE CREDITO a emitir) ${data.anticipo_pct}% de anticipo`]);
      desaccopioRow.font = { bold: true, size: 11 };
      desaccopioRow.alignment = { wrapText: true, vertical: 'center' };
      sheet.getRow(row).height = 25;
      row++;

      const subtotalRow = sheet.addRow(['', 'SUBTOTAL', '', '', '', '', '', '', '', subtotal]);
      subtotalRow.font = { bold: true, size: 11 };
      subtotalRow.alignment = { wrapText: true, vertical: 'center' };
      sheet.getRow(row).height = 20;
      row++;

      const netoRow = sheet.addRow(['', 'TOTAL NETO', '', '', '', '', '', '', '', totalNeto]);
      netoRow.font = { bold: true, color: { argb: 'FF0000FF' }, size: 12 };
      netoRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
      netoRow.alignment = { wrapText: true, vertical: 'center' };
      sheet.getRow(row).height = 22;

      row += 2;
      const noteRow = sheet.addRow(['', 'Nota: los importes no incluyen impuestos']);
      noteRow.font = { italic: true, size: 9 };

      const buffer = await workbook.xlsx.writeBuffer();
      return new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="Certificado_N${data.numero}_${data.contratista?.replace(/ /g, '_') || 'default'}.xlsx"`
        }
      });
    }

    return Response.json({ error: 'Formato no soportado' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});