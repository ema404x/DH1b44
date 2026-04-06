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

      // Configurar ancho de columnas
      for (let i = 1; i <= 14; i++) sheet.getColumn(i).width = 12;
      sheet.getColumn(2).width = 40;

      let row = 1;
      const addRow = (text, merged = true) => {
        const r = sheet.addRow([text]);
        if (merged) sheet.mergeCells(`A${row}:N${row}`);
        r.font = { bold: true, size: 11 };
        r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
        r.alignment = { wrapText: true, vertical: 'center' };
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
      row++;

      const subHeaderRow = sheet.addRow(['', '', '', '', '', '', 'Unidad', 'Importe', 'Unidad', 'Importe', 'Unidad', 'Importe', 'Unidad', 'Importe']);
      subHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
      subHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F1C2E' } };
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
        itemRow.alignment = { horizontal: 'right' };
        if (row % 2 === 0) itemRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
        row++;
      });

      // Totales
      const totalRow = sheet.addRow(['', 'TOTAL (en Pesos)', '', '', '', subtotal, '', 0, '', subtotal, '', subtotal, '', totalNeto]);
      totalRow.font = { bold: true };
      totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCC99' } };
      row += 2;

      const facturarRow = sheet.addRow(['', 'TOTAL A FACTURAR', '', '', '', '', '', '', '', subtotal]);
      facturarRow.font = { bold: true };
      row++;

      const desaccopioRow = sheet.addRow(['', `DESACOPIO ( NOTA DE CREDITO a emitir) ${data.anticipo_pct}% de anticipo`]);
      desaccopioRow.font = { bold: true };
      row++;

      const subtotalRow = sheet.addRow(['', 'SUBTOTAL', '', '', '', '', '', '', '', subtotal]);
      subtotalRow.font = { bold: true };
      row++;

      const netoRow = sheet.addRow(['', 'TOTAL NETO', '', '', '', '', '', '', '', totalNeto]);
      netoRow.font = { bold: true, color: { argb: 'FF0000FF' }, size: 12 };
      netoRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };

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