import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { file_url } = await req.json();
    
    if (!file_url) {
      return Response.json({ error: 'file_url required' }, { status: 400 });
    }

    // Descargar el archivo Excel
    const fileRes = await fetch(file_url);
    const buffer = await fileRes.arrayBuffer();

    // Usar exceljs para parsear
    const ExcelJS = await import('npm:exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const result = {
      sheets: {},
      metadata: {},
    };

    // Procesar cada hoja
    workbook.worksheets.forEach((worksheet) => {
      const sheetName = worksheet.name;
      const rows = [];

      worksheet.eachRow((row, rowNumber) => {
        const rowData = [];
        row.eachCell((cell, colNumber) => {
          rowData.push({
            colNum: colNumber,
            value: cell.value,
            formula: cell.formula,
            dataType: cell.dataType,
            style: {
              alignment: cell.alignment,
              font: cell.font,
              fill: cell.fill,
              border: cell.border,
              numFmt: cell.numFmt,
            },
          });
        });
        rows.push(rowData);
      });

      // Extraer metadata de la cabecera (primeras filas)
      const metadata = {};
      if (sheetName === 'PCP') {
        // Buscar campos clave en las primeras 15 filas
        rows.slice(0, 15).forEach((row) => {
          const firstCell = row[0]?.value;
          const valueCell = row[3]?.value || row[2]?.value;
          
          if (firstCell === 'COMITENTE') metadata.comitente = valueCell;
          if (firstCell === 'LICITACIÓN') metadata.licitacion = valueCell;
          if (firstCell === '8 A') metadata.zona = firstCell;
        });
      }

      result.sheets[sheetName] = {
        rows,
        rowCount: worksheet.rowCount,
        colCount: worksheet.columnCount,
        metadata,
        columns: worksheet.columns?.map(col => ({
          header: col.header,
          key: col.key,
          width: col.width,
        })),
      };
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});