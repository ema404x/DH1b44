import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import ExcelJS from 'npm:exceljs@4.4.0';

const COLORS = {
  RED_DARK: 'FF9B1C1C',
  RED_MAIN: 'FFC53030',
  YELLOW_ACC: 'FFFCD34D',
  GRAY_HEADER: 'FF4A5568',
  WHITE: 'FFFFFFFF',
};

const fmtARS = (n) => 
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

const fmtN = (n, d = 2) => {
  if (n == null || n === '') return '';
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
};

const fmtDate = (d) => {
  if (!d) return '';
  try { const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}`; } catch { return d; }
};

async function generatePresupuestoExcel(presupuesto) {
  const wb = new ExcelJS.Workbook();
  
  // ─── SHEET 1: PCP ───────────────────────────────────────────
  const pcp = wb.addWorksheet('PCP');
  pcp.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToHeight: 1, fitToWidth: 1 };
  pcp.margins = { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5 };
  
  // Define columns (21 cols like the template)
  const cols = Array(21).fill(0).map((_, i) => ({ width: 11 }));
  pcp.columns = cols;

  // Row 1: Title
  let row = pcp.addRow(['PLANILLA DE CÒMPUTO Y PRESUPUESTO']);
  row.getCell(1).font = { bold: true, size: 14 };
  row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.RED_DARK } };
  row.getCell(1).font = { bold: true, size: 14, color: { argb: COLORS.WHITE } };
  pcp.mergeCells(`A1:U1`);
  row.height = 22;

  // Metadata section (rows 2-8)
  const metadata = [
    ['COMITENTE', '', '', presupuesto.cliente_nombre || 'GCBA - MINISTERIO DE EDUCACIÓN DE LA CIUDAD DE BUENOS AIRES - DGMESC'],
    ['LICITACIÓN', '', '', presupuesto.licitacion || ''],
    [presupuesto.comuna || '8A', '', 'EMPRESA: MEJORES HOSPITALES S.A.', '', '', '', '', '', '', '', '', 'Nº PRESUPUESTO', '', '', '', '', '', presupuesto.codigo || ''],
    ['', '', 'DIRECCIÓN: ', presupuesto.direccion_obra || '', '', '', '', '', '', '', '', 'FECHA ingreso sap', '', '', '', '', '', fmtDate(presupuesto.fecha_emision) || ''],
    ['', '', 'ESCUELA: ', presupuesto.proyecto_nombre || '', '', '', '', '', '', '', '', 'PLAZO', '', '', '', '', '', presupuesto.plazo || ''],
    ['', '', 'OBRA: ', presupuesto.titulo || '', '', '', '', '', '', '', '', 'PRECIARIO', '', '', '', '', '', fmtDate(presupuesto.preciario_fecha) || ''],
    ['', '', 'SUPERVISOR: ', presupuesto.responsable || '', '', '', '', '', '', '', '', 'COEF. PASE', '', '', '', '', '', fmtN(presupuesto.coef_pase || 1.6504, 4)],
    ['', '', '', '', '', '', '', '', '', '', '', 'COEF. OFERTA', '', '', '', '', '', fmtN(presupuesto.coef_oferta || 1.38, 2)],
  ];

  metadata.forEach((rowData, idx) => {
    const r = pcp.addRow(rowData);
    r.height = 18;
    r.getCell(1).font = { bold: true, size: 10, color: { argb: COLORS.GRAY_HEADER } };
    
    // Style metadata labels (col 1, 2)
    for (let i = 1; i <= 3; i++) {
      if (rowData[i - 1]) {
        r.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
        r.getCell(i).font = { bold: true, size: 9, color: { argb: COLORS.GRAY_HEADER } };
        r.getCell(i).alignment = { horizontal: 'left', vertical: 'center' };
      }
    }
  });

  // Blank row
  pcp.addRow([]);

  // Table header (row 11)
  const headerRow = pcp.addRow([
    'ITEM\nPRESUP', 'ITEM\nPRECIARIO', 'DESCRIPCIÓN', 'UNID', 'CANT', 'PU MAT', 'PU MO', 'TOTAL',
    'PRECIO\nACTUAL', 'COEF\nDEFLACTOR', 'PRECIO\nDEFLACIONADO', 'COEF\nPASE', 'TOTAL\nPASE',
    'COEF\nOFERTA', 'PRECIO\nRESULTANTE', 'SUBTOTAL', '%AV', 'ANTERIOR', 'ACTUAL', 'ACUMULADO', ''
  ]);
  
  headerRow.height = 25;
  for (let i = 1; i <= 21; i++) {
    const cell = headerRow.getCell(i);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.RED_DARK } };
    cell.font = { bold: true, size: 8, color: { argb: COLORS.WHITE } };
    cell.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } },
    };
  }

  // Items
  const cp = presupuesto.coef_pase || 1.6504;
  const co = presupuesto.coef_oferta || 1.38;
  let itemNum = 1;
  let grandTotal = 0;

  (presupuesto.rubros || []).forEach((rubro) => {
    // Rubro header
    const rubroHeaderRow = pcp.addRow([rubro.nombre.toUpperCase()]);
    rubroHeaderRow.height = 18;
    rubroHeaderRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDAEEF3' } };
    rubroHeaderRow.getCell(1).font = { bold: true, size: 10, color: { argb: COLORS.RED_DARK } };
    pcp.mergeCells(`A${rubroHeaderRow.number}:U${rubroHeaderRow.number}`);

    // Items
    let rubroTotal = 0;
    (rubro.items || []).forEach((item) => {
      const pu_mat = Number(item.pu_mat) || 0;
      const pu_mo = Number(item.pu_mo) || 0;
      const pu_total = pu_mat + pu_mo;
      const tot_pase = pu_total * cp;
      const p_result = tot_pase * co;
      const subtotal = p_result * (Number(item.cantidad) || 0);
      rubroTotal += subtotal;
      grandTotal += subtotal;

      const itemRow = pcp.addRow([
        itemNum,
        item.codigo || '',
        item.descripcion || '',
        item.unidad || '',
        fmtN(item.cantidad, 2),
        fmtN(pu_mat),
        fmtN(pu_mo),
        fmtN(pu_total),
        '—',
        fmtN(6.37),
        '—',
        fmtN(cp, 4),
        fmtN(tot_pase),
        fmtN(co, 2),
        fmtN(p_result),
        fmtN(subtotal),
        '', '', '', '', ''
      ]);
      
      itemRow.height = 16;
      itemRow.getCell(15).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.YELLOW_ACC } };
      itemRow.getCell(16).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.YELLOW_ACC } };
      
      for (let i = 1; i <= 21; i++) {
        const cell = itemRow.getCell(i);
        cell.font = { size: 9 };
        cell.alignment = { horizontal: 'right', vertical: 'center' };
        if (i === 3) cell.alignment = { horizontal: 'left', vertical: 'center' };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
          right: { style: 'thin', color: { argb: 'FFD3D3D3' } },
        };
      }
      itemNum++;
    });

    // Subtotal rubro
    const subtotalRow = pcp.addRow([`Subtotal ${rubro.nombre}`, '', '', '', '', '', '', '', '', '', '', '', '', '', '', fmtARS(rubroTotal)]);
    subtotalRow.height = 18;
    subtotalRow.getCell(16).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
    subtotalRow.getCell(16).font = { bold: true, size: 9, color: { argb: COLORS.RED_DARK } };
    pcp.mergeCells(`A${subtotalRow.number}:O${subtotalRow.number}`);
  });

  // GENERALES section
  const generalesRow = pcp.addRow(['GENERALES - VOLQUETES - ANDAMIOS - LIMPIEZA DE OBRA']);
  generalesRow.height = 18;
  generalesRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.RED_MAIN } };
  generalesRow.getCell(1).font = { bold: true, size: 10, color: { argb: COLORS.WHITE } };
  pcp.mergeCells(`A${generalesRow.number}:P${generalesRow.number}`);

  // Total row
  pcp.addRow([]);
  const totalRow = pcp.addRow(['TOTAL PRESUPUESTO', '', '', '', '', '', '', '', '', '', '', '', '', '', '', fmtARS(grandTotal)]);
  totalRow.height = 20;
  totalRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.RED_DARK } };
  totalRow.getCell(1).font = { bold: true, size: 11, color: { argb: COLORS.WHITE } };
  totalRow.getCell(16).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.RED_DARK } };
  totalRow.getCell(16).font = { bold: true, size: 11, color: { argb: COLORS.WHITE } };
  pcp.mergeCells(`A${totalRow.number}:O${totalRow.number}`);

  // ─── SHEET 2: PLAN DE TRABAJOS ───────────────────────────────────────────
  const planTrab = wb.addWorksheet('PLAN DE TRABAJOS');
  planTrab.pageSetup = { paperSize: 9, orientation: 'landscape' };
  
  const planCols = Array(54).fill(0).map((_, i) => ({ width: 2 }));
  planTrab.columns = planCols;

  const planTitle = planTrab.addRow(['PLAN DE TRABAJOS']);
  planTitle.getCell(1).font = { bold: true, size: 14, color: { argb: COLORS.WHITE } };
  planTitle.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.RED_DARK } };
  planTrab.mergeCells('A1:Z1');
  planTitle.height = 22;

  // Metadata para Plan
  const planMeta = [
    ['COMITENTE', '', '', '', presupuesto.cliente_nombre || 'GCBA'],
    ['LICITACIÒN', '', '', '', presupuesto.licitacion || ''],
    [presupuesto.comuna || '8A', '', '', '', 'EMPRESA: MEJORES HOSPITALES S.A.', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Nº PRESUPUESTO', '', '', '', '', '', '', '', 0],
    ['', '', '', '', 'DIRECCIÓN: ', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'FECHA ingreso sap', '', '', '', '', '', '', '', '00:00:00'],
  ];

  planMeta.forEach((rowData) => {
    const r = planTrab.addRow(rowData);
    r.height = 16;
  });

  // ─── SHEET 3: ORDEN TAREAS ───────────────────────────────────────────
  const ordenTareas = wb.addWorksheet('ORDEN TAREAS');
  ordenTareas.columns = [{ width: 5 }, { width: 40 }];

  const tareas = [
    [1, 'DEMOLICIONES'],
    [2, 'MOVIMIENTO DE SUELOS'],
    [3, 'ESTRUCTURAS'],
    [4, 'ALBAÑILERÍA'],
    [5, 'CONSTRUCCIÓN EN SECO y TABIQUERÍA'],
    [6, 'HERRERÍAS'],
    [7, 'INSTALACIONES ELÉCTRICAS'],
    [8, 'INSTALACIONES DE GAS'],
    [9, 'INSTALACIONES SANITARIAS'],
    [10, 'INSTALACIONES DE CLIMATIZACIÓN'],
    [11, 'OBRAS EXTERIORES'],
    [12, 'PINTURA'],
    [13, 'CARPINTERÍA'],
    [14, 'VIDRIERÍA'],
    [15, 'MUEBLES Y EQUIPAMIENTO'],
    [16, 'SEÑALÉTICA'],
    [17, 'OBRAS DE ARTE Y APLACADOS'],
    [18, 'INSTALACIÓN DE EQUIPOS'],
    [19, 'LIMPIEZA Y DESMALEZAMIENTO'],
    [20, 'SEGURIDAD EN OBRA'],
    [21, 'INSPECCIONES Y CONTROL'],
  ];

  tareas.forEach((tarea) => {
    const r = ordenTareas.addRow(tarea);
    r.getCell(1).font = { bold: true, size: 10 };
    r.getCell(2).font = { size: 10 };
  });

  // Generar archivo
  const buffer = await wb.xlsx.writeBuffer();
  return buffer;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { presupuestoId } = await req.json();
    const presupuesto = await base44.entities.PresupuestoObra.get(presupuestoId);
    
    const excelBuffer = await generatePresupuestoExcel(presupuesto);
    const { file_url } = await base44.integrations.Core.UploadFile({ file: excelBuffer });

    return Response.json({ file_url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});