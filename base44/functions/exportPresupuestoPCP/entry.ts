import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import ExcelJS from 'npm:exceljs@4.4.0';

// ─────────────────────────────────────────────────────────────────────────────
// Genera el Excel en formato PCP (Planilla de Cómputo y Presupuesto)
// del Ministerio de Educación GCBA - DGMESC
// ─────────────────────────────────────────────────────────────────────────────

const MEJORES_LOGO_URL = 'https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/b6844473f_mejores_cover.jpg';
const COLOR_HEADER = '0F1C2E';
const COLOR_UBICACION = '1A3A5C';
const COLOR_RUBRO_BG = 'DBEAFE';
const COLOR_WHITE = 'FFFFFF';
const COLOR_ALT = 'F7F9FC';

async function loadLogoBuffer(url) {
  try {
    const res = await fetch(url);
    return await res.arrayBuffer();
  } catch { return null; }
}

function hFill(argb) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${argb}` } };
}

function hFont(bold = true, color = COLOR_WHITE, size = 9) {
  return { bold, color: { argb: `FF${color}` }, size, name: 'Calibri' };
}

function thinBorder() {
  const s = { style: 'thin', color: { argb: 'FFB0BEC5' } };
  return { top: s, bottom: s, left: s, right: s };
}

function numFmt(cell, fmt) { cell.numFmt = fmt; }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { presupuestoId } = await req.json();
    if (!presupuestoId) return Response.json({ error: 'presupuestoId requerido' }, { status: 400 });

    // Cargar el presupuesto
    const presupuestos = await base44.entities.PresupuestoObra.filter({ id: presupuestoId });
    if (!presupuestos.length) return Response.json({ error: 'Presupuesto no encontrado' }, { status: 404 });
    const form = presupuestos[0];

    // Cargar preciario de la comuna correspondiente
    const comunaKey = form.comuna || '8A';
    const precarioItems = await base44.asServiceRole.entities.PrecarioMinisterio.filter({ comuna: comunaKey }, 'codigo', 500);

    const coefPase = form.coef_pase || 1.6504;
    const coefOferta = form.coef_oferta || 1.38;

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('PCP');

    // Columnas
    ws.columns = [
      { width: 10 }, { width: 13 }, { width: 50 }, { width: 8 }, { width: 10 },
      { width: 14 }, { width: 14 }, { width: 14 },
      { width: 14 }, { width: 10 }, { width: 14 },
      { width: 10 }, { width: 14 }, { width: 10 }, { width: 16 },
      { width: 14 }, { width: 8 }, { width: 8 }, { width: 8 },
    ];

    let r = 0;

    // ── Fila 1 — Logo ────────────────────────────────────────────────────────
    r++;
    ws.mergeCells(`A${r}:S${r}`);
    ws.getRow(r).height = 42;
    ws.getCell(`A${r}`).fill = hFill(COLOR_HEADER);

    const logoBuffer = await loadLogoBuffer(MEJORES_LOGO_URL);
    if (logoBuffer) {
      const imgId = wb.addImage({ buffer: logoBuffer, extension: 'jpeg' });
      ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: 200, height: 40 }, editAs: 'oneCell' });
    }

    // ── Fila 2 — Título PCP ──────────────────────────────────────────────────
    r++;
    ws.mergeCells(`A${r}:S${r}`);
    const t = ws.getCell(`A${r}`);
    t.value = 'PLANILLA DE CÓMPUTO Y PRESUPUESTO';
    t.font = hFont(true, COLOR_WHITE, 13);
    t.fill = hFill(COLOR_HEADER);
    t.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(r).height = 22;

    // ── Filas 3–10: datos institucionales ───────────────────────────────────
    const infoRows = [
      ['COMITENTE', 'GCBA - MINISTERIO DE EDUCACIÓN DE LA CIUDAD DE BUENOS AIRES - DGMESC'],
      ['LICITACIÓN', form.licitacion || form.ada_numero || ''],
    ];
    for (const [label, val] of infoRows) {
      r++;
      ws.getRow(r).height = 14;
      ws.mergeCells(`A${r}:C${r}`);
      ws.getCell(`A${r}`).value = label;
      ws.getCell(`A${r}`).font = hFont(true, '1A3A5C', 9);
      ws.mergeCells(`D${r}:S${r}`);
      ws.getCell(`D${r}`).value = val;
      ws.getCell(`D${r}`).font = { size: 9, name: 'Calibri' };
    }

    // Fila con nombre de empresa y N° presupuesto
    r++;
    ws.getRow(r).height = 14;
    ws.mergeCells(`A${r}:B${r}`);
    ws.getCell(`A${r}`).value = comunaKey;
    ws.getCell(`A${r}`).font = hFont(true, '1A3A5C', 11);
    ws.mergeCells(`C${r}:K${r}`);
    ws.getCell(`C${r}`).value = 'EMPRESA: MEJORES HOSPITALES S.A.';
    ws.getCell(`C${r}`).font = hFont(true, '0F1C2E', 9);
    ws.mergeCells(`L${r}:N${r}`);
    ws.getCell(`L${r}`).value = 'Nº PRESUPUESTO';
    ws.getCell(`L${r}`).font = hFont(true, '1A3A5C', 9);
    ws.mergeCells(`O${r}:S${r}`);
    ws.getCell(`O${r}`).value = form.codigo || '';
    ws.getCell(`O${r}`).font = { size: 9, name: 'Calibri' };

    // Dirección
    r++;
    ws.getRow(r).height = 14;
    ws.mergeCells(`C${r}:K${r}`);
    ws.getCell(`C${r}`).value = `DIRECCIÓN: ${form.direccion_obra || ''}`;
    ws.getCell(`C${r}`).font = { size: 9, name: 'Calibri' };
    ws.mergeCells(`L${r}:N${r}`);
    ws.getCell(`L${r}`).value = 'FECHA ingreso SAP';
    ws.getCell(`L${r}`).font = hFont(true, '1A3A5C', 9);
    ws.mergeCells(`O${r}:S${r}`);
    ws.getCell(`O${r}`).value = form.fecha_emision || '';
    ws.getCell(`O${r}`).font = { size: 9, name: 'Calibri' };

    // Escuela / Obra
    r++;
    ws.getRow(r).height = 14;
    ws.mergeCells(`C${r}:K${r}`);
    ws.getCell(`C${r}`).value = `ESCUELA: ${form.proyecto_nombre || ''}`;
    ws.getCell(`C${r}`).font = { size: 9, name: 'Calibri' };
    ws.mergeCells(`L${r}:N${r}`);
    ws.getCell(`L${r}`).value = 'PLAZO';
    ws.getCell(`L${r}`).font = hFont(true, '1A3A5C', 9);
    ws.mergeCells(`O${r}:S${r}`);
    ws.getCell(`O${r}`).value = form.plazo || '';

    r++;
    ws.getRow(r).height = 14;
    ws.mergeCells(`C${r}:K${r}`);
    ws.getCell(`C${r}`).value = `OBRA: ${form.titulo || ''}`;
    ws.getCell(`C${r}`).font = { size: 9, name: 'Calibri' };
    ws.mergeCells(`L${r}:N${r}`);
    ws.getCell(`L${r}`).value = 'Preciario Utilizado';
    ws.getCell(`L${r}`).font = hFont(true, '1A3A5C', 9);
    ws.mergeCells(`O${r}:P${r}`);
    ws.getCell(`O${r}`).value = form.preciario_fecha || '2023-02-01';

    r++;
    ws.getRow(r).height = 14;
    ws.mergeCells(`L${r}:N${r}`);
    ws.getCell(`L${r}`).value = 'Coef. Pase';
    ws.getCell(`L${r}`).font = hFont(true, '1A3A5C', 9);
    ws.mergeCells(`O${r}:P${r}`);
    ws.getCell(`O${r}`).value = coefPase;
    ws.getCell(`O${r}`).numFmt = '0.0000';

    r++;
    ws.getRow(r).height = 14;
    ws.mergeCells(`A${r}:B${r}`);
    ws.getCell(`A${r}`).value = 'MTOM Nº';
    ws.getCell(`A${r}`).font = hFont(true, '1A3A5C', 9);
    ws.mergeCells(`C${r}:K${r}`);
    ws.getCell(`C${r}`).value = `SUPERVISOR: ${form.responsable || ''}`;
    ws.getCell(`C${r}`).font = { size: 9, name: 'Calibri' };
    ws.mergeCells(`L${r}:N${r}`);
    ws.getCell(`L${r}`).value = 'Coef. Oferta';
    ws.getCell(`L${r}`).font = hFont(true, '1A3A5C', 9);
    ws.mergeCells(`O${r}:P${r}`);
    ws.getCell(`O${r}`).value = coefOferta;
    ws.getCell(`O${r}`).numFmt = '0.00';

    // ── Espacio ──────────────────────────────────────────────────────────────
    r++;
    ws.getRow(r).height = 5;

    // ── Encabezado tabla — fila 1 de 2 ─────────────────────────────────────
    r++;
    ws.getRow(r).height = 30;
    const H1 = [
      ['A', 'A', 'ITEM\nPRESUP'], ['B', 'B', 'ITEM\nPRECIARIO'], ['C', 'C', 'DESCRIPCIÓN'],
      ['D', 'E', 'CÓMPUTO'], ['F', 'H', 'PRECIOS UNITARIOS'],
      ['I', 'K', 'DEFLACIÓN DE MATERIALES\nFUERA DE PRECIARIO'],
      ['L', 'M', 'COEFICIENTE DE PASE'], ['N', 'N', 'COEF.\nOFERTA'],
      ['O', 'O', 'SUBTOTAL'], ['P', 'P', 'AVANCE'], ['Q', 'S', 'PORCENTAJE DE AVANCE'],
    ];
    for (const [from, to, label] of H1) {
      const ref = from === to ? `${from}${r}` : `${from}${r}:${to}${r}`;
      if (from !== to) ws.mergeCells(ref);
      const cell = ws.getCell(`${from}${r}`);
      cell.value = label;
      cell.font = hFont(true, COLOR_WHITE, 8);
      cell.fill = hFill(COLOR_HEADER);
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = thinBorder();
    }

    // ── Encabezado tabla — fila 2 de 2 ─────────────────────────────────────
    r++;
    ws.getRow(r).height = 22;
    const H2 = ['', '', '', 'UNID.', 'CANT.', 'P.U.MAT.', 'P.U.M.O.', 'TOTAL',
      'PRECIO ACTUAL\nSIN IVA', 'COEF.\nDEFLADOR', 'PRECIO\nDEFLACIONADO',
      'COEF.', 'TOTAL', 'COEF.', 'PRECIO\nRESULTANTE',
      '', 'ANTERIOR', 'ACTUAL', 'ACUMULADO'];
    H2.forEach((val, i) => {
      const col = String.fromCharCode(65 + i);
      const cell = ws.getCell(`${col}${r}`);
      cell.value = val;
      cell.font = hFont(true, COLOR_WHITE, 7.5);
      cell.fill = hFill(COLOR_HEADER);
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = thinBorder();
    });

    // ── Ítems ────────────────────────────────────────────────────────────────
    let itemNum = 1;
    let totalGeneral = 0;
    const rubros = form.rubros || [];

    // Agrupar por ubicación si el presupuesto tiene ese campo, si no usar directamente
    const ubicaciones = form.ubicaciones || [{ nombre: form.titulo || 'OBRA', rubros }];

    for (const ubicacion of ubicaciones) {
      // UBICACIÓN header
      r++;
      ws.getRow(r).height = 16;
      ws.mergeCells(`A${r}:N${r}`);
      const uCell = ws.getCell(`A${r}`);
      uCell.value = `UBICACIÓN - ZONA DE TRABAJO: ${(ubicacion.nombre || '').toUpperCase()}`;
      uCell.font = hFont(true, COLOR_WHITE, 9);
      uCell.fill = hFill(COLOR_UBICACION);
      uCell.alignment = { vertical: 'middle' };
      uCell.border = thinBorder();

      ws.getCell(`O${r}`).value = 'TOTAL';
      ws.getCell(`O${r}`).font = hFont(true, COLOR_WHITE, 9);
      ws.getCell(`O${r}`).fill = hFill(COLOR_UBICACION);
      ws.getCell(`O${r}`).alignment = { horizontal: 'center' };
      ws.mergeCells(`P${r}:S${r}`);
      ws.getCell(`P${r}`).fill = hFill(COLOR_UBICACION);

      let ubicacionTotal = 0;

      for (const rubro of (ubicacion.rubros || [])) {
        // RUBRO header
        r++;
        ws.getRow(r).height = 15;
        ws.mergeCells(`A${r}:S${r}`);
        const rbCell = ws.getCell(`A${r}`);
        rbCell.value = `  RUBRO: ${(rubro.nombre || '').toUpperCase()}`;
        rbCell.font = hFont(true, '0A1834', 9);
        rbCell.fill = hFill('DBEAFE');
        rbCell.alignment = { vertical: 'middle' };

        let rubroTotal = 0;

        for (const item of (rubro.items || [])) {
          r++;
          ws.getRow(r).height = 13;

          // Buscar en preciario
          const pi = precarioItems.find(p => p.codigo === item.precario_id || p.codigo === item.codigo);
          const puMat = pi ? (pi.pu_mat || 0) : 0;
          const puMo = pi ? (pi.pu_mo || 0) : 0;
          const totalPU = puMat + puMo;
          const totalConPase = pi ? (pi.total_coef_pase || 0) : totalPU * coefPase;
          const precioResultante = (item.cantidad || 0) * (item.precio_unitario || pi?.total_coef_oferta || 0);

          rubroTotal += precioResultante;

          const isAlt = (r % 2 === 0);
          const bg = isAlt ? COLOR_ALT : COLOR_WHITE;

          const vals = [
            itemNum, item.precario_id || item.codigo || '', item.descripcion || '',
            item.unidad || pi?.unidad || '', item.cantidad || 0,
            puMat, puMo, totalPU,
            0, 6.37, 0,
            coefPase, totalConPase, coefOferta, precioResultante,
            0, 0, 0, 0,
          ];

          vals.forEach((val, i) => {
            const col = String.fromCharCode(65 + i);
            const cell = ws.getCell(`${col}${r}`);
            cell.value = val;
            cell.fill = hFill(bg);
            cell.border = thinBorder();
            cell.font = { size: 8, name: 'Calibri', bold: i === 14 };
            if (i === 2) cell.alignment = { vertical: 'middle' };
            else if (i >= 4) cell.alignment = { horizontal: 'right', vertical: 'middle' };
            else cell.alignment = { horizontal: 'center', vertical: 'middle' };
            if ([5, 6, 7, 8, 10, 12, 14, 15].includes(i)) cell.numFmt = '#,##0.00';
            if ([4, 9, 11, 13].includes(i)) cell.numFmt = '0.0000';
          });

          itemNum++;
        }

        // Subtotal rubro
        r++;
        ws.getRow(r).height = 13;
        ws.mergeCells(`A${r}:N${r}`);
        ws.getCell(`A${r}`).value = `  Subtotal ${rubro.nombre || ''}`;
        ws.getCell(`A${r}`).font = { bold: true, italic: true, size: 8, name: 'Calibri', color: { argb: 'FF1A3A5C' } };
        ws.getCell(`A${r}`).fill = hFill('EBF4FF');
        ws.getCell(`A${r}`).alignment = { vertical: 'middle' };

        const stCell = ws.getCell(`O${r}`);
        stCell.value = rubroTotal;
        stCell.numFmt = '#,##0.00';
        stCell.font = { bold: true, size: 8, name: 'Calibri' };
        stCell.fill = hFill('EBF4FF');
        stCell.alignment = { horizontal: 'right', vertical: 'middle' };
        ws.mergeCells(`P${r}:S${r}`);
        ws.getCell(`P${r}`).fill = hFill('EBF4FF');

        ubicacionTotal += rubroTotal;
        totalGeneral += rubroTotal;
      }

      // Total ubicación
      r++;
      ws.getRow(r).height = 16;
      ws.mergeCells(`A${r}:N${r}`);
      ws.getCell(`A${r}`).value = `TOTAL ${(ubicacion.nombre || '').toUpperCase()}`;
      ws.getCell(`A${r}`).font = hFont(true, COLOR_WHITE, 9);
      ws.getCell(`A${r}`).fill = hFill(COLOR_UBICACION);
      ws.getCell(`A${r}`).alignment = { vertical: 'middle' };

      const utCell = ws.getCell(`O${r}`);
      utCell.value = ubicacionTotal;
      utCell.numFmt = '#,##0.00';
      utCell.font = hFont(true, 'F59E0B', 10);
      utCell.fill = hFill(COLOR_UBICACION);
      utCell.alignment = { horizontal: 'right', vertical: 'middle' };
      ws.mergeCells(`P${r}:S${r}`);
      ws.getCell(`P${r}`).fill = hFill(COLOR_UBICACION);

      r++;
      ws.getRow(r).height = 5;
    }

    // ── TOTAL PRESUPUESTO ─────────────────────────────────────────────────────
    r++;
    ws.getRow(r).height = 20;
    ws.mergeCells(`A${r}:N${r}`);
    ws.getCell(`A${r}`).value = 'TOTAL PRESUPUESTO';
    ws.getCell(`A${r}`).font = hFont(true, COLOR_WHITE, 12);
    ws.getCell(`A${r}`).fill = hFill(COLOR_HEADER);
    ws.getCell(`A${r}`).alignment = { vertical: 'middle' };

    const tgCell = ws.getCell(`O${r}`);
    tgCell.value = totalGeneral;
    tgCell.numFmt = '#,##0.00';
    tgCell.font = { bold: true, size: 13, color: { argb: 'FFF59E0B' }, name: 'Calibri' };
    tgCell.fill = hFill(COLOR_HEADER);
    tgCell.alignment = { horizontal: 'right', vertical: 'middle' };
    ws.mergeCells(`P${r}:S${r}`);
    ws.getCell(`P${r}`).fill = hFill(COLOR_HEADER);

    // Notas
    if (form.notas) {
      r += 2;
      ws.mergeCells(`A${r}:S${r}`);
      ws.getCell(`A${r}`).value = `NOTAS: ${form.notas}`;
      ws.getCell(`A${r}`).font = { italic: true, size: 8, name: 'Calibri', color: { argb: 'FF607D8B' } };
      ws.getRow(r).height = 14;
    }

    // Congelar encabezados
    ws.views = [{ state: 'frozen', ySplit: 14, xSplit: 2 }];

    // ── Generar buffer y subir ────────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer();

    const uploadResult = await base44.integrations.Core.UploadFile({ file: buffer });

    return Response.json({
      success: true,
      file_url: uploadResult.file_url,
      filename: `PCP_${form.codigo || form.titulo}_MEJORES.xlsx`
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});