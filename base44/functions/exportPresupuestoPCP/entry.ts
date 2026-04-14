import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import ExcelJS from 'npm:exceljs@4.4.0';

// ─────────────────────────────────────────────────────────────────────────────
// PLANILLA DE CÓMPUTO Y PRESUPUESTO — Formato exacto Ministerio de Educación
// GCBA - DGMESC  /  MEJORES HOSPITALES S.A.
// ─────────────────────────────────────────────────────────────────────────────

const LOGO_URL  = 'https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/b6844473f_mejores_cover.jpg';

// Paleta oficial
const NAVY      = '0A1834';   // azul muy oscuro (header/total)
const NAVY2     = '1D4060';   // azul medio (ubicación, labels)
const BLUE_H    = 'C5D9F1';   // azul claro header columnas
const BLUE_L    = 'DCE6F1';   // azul muy claro sub-header
const BLUE_UB   = 'BDD7EE';   // ubicacion
const WHITE     = 'FFFFFF';
const OFF_WHITE = 'EFF3F7';   // fondo filas pares
const YELLOW    = 'FFFF99';   // precio resultante
const GREEN     = 'E2EFDA';   // subtotal rubro
const ORANGE    = 'FCE4D6';   // deflación
const TOTAL_BG  = '0A1834';

async function loadLogo() {
  try {
    const res = await fetch(LOGO_URL);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch { return null; }
}

function fill(argb) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${argb}` } };
}

function font(bold, color, size = 9, italic = false) {
  return { bold, italic, color: { argb: `FF${color}` }, size, name: 'Arial' };
}

function border(color = 'B0BEC5', style = 'thin') {
  const s = { style, color: { argb: `FF${color}` } };
  return { top: s, bottom: s, left: s, right: s };
}

function borderMedium() {
  const s = { style: 'medium', color: { argb: `FF${NAVY}` } };
  return { top: s, bottom: s, left: s, right: s };
}

function applyHeader(cell, text, bgArgb, fontColor = WHITE, sz = 9, wrap = true) {
  cell.value    = text;
  cell.fill     = fill(bgArgb);
  cell.font     = font(true, fontColor, sz);
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: wrap };
  cell.border   = border(NAVY, 'thin');
}

function numCell(cell, val, bgArgb, fmtStr = '#,##0.00', fColor = '1D1D1D', bold = false) {
  cell.value     = val === 0 ? 0 : (val || null);
  cell.fill      = fill(bgArgb);
  cell.numFmt    = fmtStr;
  cell.font      = font(bold, fColor, 8);
  cell.alignment = { horizontal: 'right', vertical: 'middle' };
  cell.border    = border();
}

function txtCell(cell, val, bgArgb, align = 'left', bold = false, fColor = '1D1D1D', sz = 8) {
  cell.value     = val ?? '';
  cell.fill      = fill(bgArgb);
  cell.font      = font(bold, fColor, sz);
  cell.alignment = { horizontal: align, vertical: 'middle', wrapText: true };
  cell.border    = border();
}

function fmtDate(d) {
  if (!d) return '';
  try { const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; } catch { return d; }
}

// 21 columnas: A..U
// A=ITEM, B=PRECIARIO, C=DESC, D=UNID, E=CANT,
// F=PUMAT, G=PUMO, H=TOT PU,
// I=DEFL PRECIO, J=DEFL COEF, K=DEFL DEFLAC,
// L=COEF PASE, M=TOT PASE,
// N=COEF OFERTA, O=PRECIO RESULT,
// P=SUBTOTAL,
// Q=% AVANCE, R=ANT, S=ACT, T=ACUM, U=vacío

const COL_WIDTHS = [9, 13, 52, 7, 9, 14, 14, 14, 14, 9, 14, 9, 14, 9, 16, 14, 9, 11, 11, 11, 5];
const NCOLS = 21;
function colLetter(i) { return String.fromCharCode(65 + i); } // 0=A, 1=B, ...

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { presupuestoId } = await req.json();
    if (!presupuestoId) return Response.json({ error: 'presupuestoId requerido' }, { status: 400 });

    const [form] = await base44.entities.PresupuestoObra.filter({ id: presupuestoId });
    if (!form) return Response.json({ error: 'Presupuesto no encontrado' }, { status: 404 });

    const cp = Number(form.coef_pase)   || 1.6504;
    const co = Number(form.coef_oferta) || 1.38;
    const DEFL_COEF = 6.37;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'MEJORES HOSPITALES S.A.';
    const ws = wb.addWorksheet('PCP', {
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, paperSize: 9 }
    });

    ws.columns = COL_WIDTHS.map(w => ({ width: w }));

    let R = 0; // row index (1-based after increment)

    // ── FILA 1: Logo ─────────────────────────────────────────────────────────
    R++;
    ws.getRow(R).height = 46;
    ws.mergeCells(`A${R}:${colLetter(NCOLS-1)}${R}`);
    const logoCell = ws.getCell(`A${R}`);
    logoCell.fill = fill(NAVY);

    const logoBuffer = await loadLogo();
    if (logoBuffer) {
      const imgId = wb.addImage({ buffer: logoBuffer, extension: 'jpeg' });
      // Posicionar logo en la celda A1, tamaño aproximado
      ws.addImage(imgId, {
        tl: { col: 0, row: 0 },
        br: { col: 3, row: 1 },
        editAs: 'oneCell'
      });
    }

    // Título a la derecha del logo
    ws.getCell(`D${R}`).value = 'PLANILLA DE CÓMPUTO Y PRESUPUESTO';
    ws.getCell(`D${R}`).font = font(true, WHITE, 13);
    ws.getCell(`D${R}`).fill = fill(NAVY);
    ws.getCell(`D${R}`).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.mergeCells(`D${R}:${colLetter(NCOLS-1)}${R}`);

    // ── FILAS 2–9: Bloque de metadatos ───────────────────────────────────────
    // Estructura: col A-B = label, col C-K = valor izq | col L-N = label, col O-U = valor der

    const metaLeft = [
      ['COMITENTE',   form.cliente_nombre || 'GCBA - MINISTERIO DE EDUCACIÓN DE LA CIUDAD DE BUENOS AIRES - DGMESC'],
      ['LICITACIÓN',  form.licitacion || ''],
      ['',            `EMPRESA: MEJORES HOSPITALES S.A.    ZONA: ${form.comuna || ''}`],
      ['',            `DIRECCIÓN: ${form.direccion_obra || ''}`],
      ['',            `ESCUELA: ${form.proyecto_nombre || ''}`],
      ['',            `OBRA: ${form.titulo || ''}`],
      ['',            ''],
      ['MTOM Nº',     `SUPERVISOR: ${form.responsable || ''}`],
    ];

    const metaRight = [
      ['', ''],
      ['', ''],
      ['Nº PRESUPUESTO',    form.codigo || ''],
      ['FECHA ingreso SAP', fmtDate(form.fecha_emision)],
      ['PLAZO',             form.plazo || ''],
      ['Preciario Utilizado', fmtDate(form.preciario_fecha)],
      ['Coef. Pase',        cp],
      ['Coef. Oferta',      co],
    ];

    for (let i = 0; i < metaLeft.length; i++) {
      R++;
      ws.getRow(R).height = 14;
      const [lbl, val] = metaLeft[i];
      const [rlbl, rval] = metaRight[i];

      if (lbl) {
        ws.getCell(`A${R}`).value = lbl;
        ws.getCell(`A${R}`).font = font(true, NAVY2, 9);
        ws.mergeCells(`A${R}:B${R}`);
      }

      ws.getCell(`C${R}`).value = val;
      ws.getCell(`C${R}`).font = font(false, '1D1D1D', 9);
      ws.mergeCells(`C${R}:K${R}`);

      if (rlbl) {
        ws.getCell(`L${R}`).value = rlbl;
        ws.getCell(`L${R}`).font = font(true, NAVY2, 9);
        ws.mergeCells(`L${R}:N${R}`);
      }

      if (rval !== '') {
        const rc = ws.getCell(`O${R}`);
        if (typeof rval === 'number') {
          rc.value = rval;
          rc.numFmt = rval === cp ? '0.0000' : '0.00';
          rc.font = font(false, '1D1D1D', 9);
        } else {
          rc.value = rval;
          rc.font = font(false, '1D1D1D', 9);
        }
        ws.mergeCells(`O${R}:${colLetter(NCOLS-1)}${R}`);
      }
    }

    // ── Separador ─────────────────────────────────────────────────────────────
    R++;
    ws.getRow(R).height = 4;

    // ── FILA ENCABEZADO TABLA — Fila 1 de 2 (grupos) ─────────────────────────
    R++;
    ws.getRow(R).height = 32;
    const H1_GROUPS = [
      [0, 0, 'ITEM\nPRESUP'],
      [1, 1, 'ITEM\nPRECIARIO'],
      [2, 2, 'DESCRIPCIÓN'],
      [3, 4, 'CÓMPUTO'],
      [5, 7, 'PRECIOS UNITARIOS'],
      [8, 10, 'DEFLACIÓN DE MATERIALES\nFUERA DE PRECIARIO'],
      [11, 12, 'COEFICIENTE\nDE PASE'],
      [13, 13, 'COEF.\nOFERTA'],
      [14, 14, 'PRECIO\nRESULTANTE'],
      [15, 15, 'SUBTOTAL'],
      [16, 16, '% AVANCE'],
      [17, 19, 'AVANCE'],
      [20, 20, ''],
    ];
    for (const [c1, c2, label] of H1_GROUPS) {
      const ref = c1 === c2
        ? `${colLetter(c1)}${R}`
        : `${colLetter(c1)}${R}:${colLetter(c2)}${R}`;
      if (c1 !== c2) ws.mergeCells(ref);
      applyHeader(ws.getCell(`${colLetter(c1)}${R}`), label, NAVY, WHITE, 8);
    }

    // ── FILA ENCABEZADO TABLA — Fila 2 de 2 (sub-columnas) ───────────────────
    R++;
    ws.getRow(R).height = 28;
    const H2_LABELS = [
      '', '', '', 'UNID.', 'CANT.',
      'P.U.MAT.', 'P.U.M.O.', 'TOTAL',
      'PRECIO ACTUAL\nSIN IVA', 'COEF.\nDEFLACTOR', 'PRECIO\nDEFLACIONADO',
      'COEF.', 'TOTAL',
      'COEF.', 'PRECIO\nRESULTANTE',
      '',
      '',
      'ANTERIOR', 'ACTUAL', 'ACUMULADO',
      ''
    ];
    H2_LABELS.forEach((lbl, i) => {
      applyHeader(ws.getCell(`${colLetter(i)}${R}`), lbl, BLUE_H, NAVY, 7.5);
    });

    // ── ÍTEMS ─────────────────────────────────────────────────────────────────
    const rubros = form.rubros || [];
    let itemNum = 1;
    let grandTotal = 0;

    for (const rubro of rubros) {
      let rubroTotal = 0;

      // RUBRO header
      R++;
      ws.getRow(R).height = 16;
      ws.mergeCells(`A${R}:O${R}`);
      const rbCell = ws.getCell(`A${R}`);
      rbCell.value = `  RUBRO: ${(rubro.nombre || '').toUpperCase()}`;
      rbCell.fill     = fill(BLUE_UB);
      rbCell.font     = font(true, NAVY, 9);
      rbCell.alignment = { horizontal: 'left', vertical: 'middle' };
      rbCell.border   = borderMedium();
      // rellenar resto
      for (let c = 15; c < NCOLS; c++) {
        ws.getCell(`${colLetter(c)}${R}`).fill = fill(BLUE_UB);
        ws.getCell(`${colLetter(c)}${R}`).border = border(NAVY, 'thin');
      }

      for (const item of (rubro.items || [])) {
        R++;
        ws.getRow(R).height = 13;

        const pu_mat   = Number(item.pu_mat)   || 0;
        const pu_mo    = Number(item.pu_mo)    || 0;
        const pu_total = pu_mat + pu_mo;

        // Deflación (vacío para ítems de preciario)
        const defl_precio = 0;
        const defl_coef   = DEFL_COEF;
        const defl_deflac = 0;

        const total_pase    = pu_total * cp;
        const precio_result = total_pase * co;
        const subtotal      = precio_result * (Number(item.cantidad) || 0);

        rubroTotal  += subtotal;
        grandTotal  += subtotal;

        const isAlt = itemNum % 2 === 0;
        const bg = isAlt ? OFF_WHITE : WHITE;

        // A: ítem
        txtCell(ws.getCell(`A${R}`), String(itemNum), bg, 'center', false);
        // B: código preciario
        txtCell(ws.getCell(`B${R}`), item.codigo || '', bg, 'center', false);
        // C: descripción
        txtCell(ws.getCell(`C${R}`), item.descripcion || '', bg, 'left', false);
        // D: unidad
        txtCell(ws.getCell(`D${R}`), item.unidad || '', bg, 'center', false);
        // E: cantidad
        numCell(ws.getCell(`E${R}`), Number(item.cantidad) || 0, bg, '0.00');
        // F: PU MAT
        numCell(ws.getCell(`F${R}`), pu_mat, bg, '#,##0.00');
        // G: PU MO
        numCell(ws.getCell(`G${R}`), pu_mo, bg, '#,##0.00');
        // H: TOTAL PU
        numCell(ws.getCell(`H${R}`), pu_total, bg, '#,##0.00');
        // I: Deflación precio actual sin IVA
        numCell(ws.getCell(`I${R}`), defl_precio || null, ORANGE, '#,##0.00');
        // J: Coef deflactor
        numCell(ws.getCell(`J${R}`), defl_coef, ORANGE, '0.00');
        // K: Precio deflacionado
        numCell(ws.getCell(`K${R}`), defl_deflac || null, ORANGE, '#,##0.00');
        // L: Coef pase
        numCell(ws.getCell(`L${R}`), cp, bg, '0.0000');
        // M: Total pase
        numCell(ws.getCell(`M${R}`), total_pase, bg, '#,##0.00');
        // N: Coef oferta
        numCell(ws.getCell(`N${R}`), co, bg, '0.00');
        // O: Precio resultante — amarillo
        numCell(ws.getCell(`O${R}`), precio_result, YELLOW, '#,##0.00', NAVY, true);
        // P: Subtotal — amarillo
        numCell(ws.getCell(`P${R}`), subtotal, YELLOW, '#,##0.00', NAVY, true);
        // Q: % avance
        numCell(ws.getCell(`Q${R}`), 0, OFF_WHITE, '0%');
        // R, S, T: avance anterior, actual, acumulado
        numCell(ws.getCell(`R${R}`), 0, OFF_WHITE, '#,##0.00');
        numCell(ws.getCell(`S${R}`), 0, OFF_WHITE, '#,##0.00');
        numCell(ws.getCell(`T${R}`), 0, OFF_WHITE, '#,##0.00');
        // U: vacío
        ws.getCell(`U${R}`).fill = fill(OFF_WHITE);
        ws.getCell(`U${R}`).border = border();

        itemNum++;
      }

      // Subtotal rubro — fondo verde
      R++;
      ws.getRow(R).height = 14;
      ws.mergeCells(`A${R}:O${R}`);
      const subCell = ws.getCell(`A${R}`);
      subCell.value     = `  Subtotal ${rubro.nombre || ''}`;
      subCell.fill      = fill(GREEN);
      subCell.font      = font(true, NAVY2, 9, true);
      subCell.alignment = { horizontal: 'left', vertical: 'middle' };
      subCell.border    = borderMedium();

      const subTotalCell = ws.getCell(`P${R}`);
      subTotalCell.value     = rubroTotal;
      subTotalCell.numFmt    = '#,##0.00';
      subTotalCell.fill      = fill(GREEN);
      subTotalCell.font      = font(true, NAVY, 9);
      subTotalCell.alignment = { horizontal: 'right', vertical: 'middle' };
      subTotalCell.border    = borderMedium();

      for (let c = 16; c < NCOLS; c++) {
        ws.getCell(`${colLetter(c)}${R}`).fill = fill(GREEN);
        ws.getCell(`${colLetter(c)}${R}`).border = border();
      }

      R++;
      ws.getRow(R).height = 3;
    }

    // ── GENERALES - VOLQUETES - LIMPIEZA (filas vacías para completar a mano)
    R++;
    ws.getRow(R).height = 15;
    ws.mergeCells(`A${R}:O${R}`);
    const genCell = ws.getCell(`A${R}`);
    genCell.value     = '  GENERALES - VOLQUETES - ANDAMIOS - LIMPIEZA DE OBRA';
    genCell.fill      = fill(BLUE_L);
    genCell.font      = font(true, NAVY, 9);
    genCell.alignment = { horizontal: 'left', vertical: 'middle' };
    genCell.border    = borderMedium();
    ws.getCell(`P${R}`).fill = fill(BLUE_L);
    for (let c = 16; c < NCOLS; c++) ws.getCell(`${colLetter(c)}${R}`).fill = fill(BLUE_L);

    for (let gi = 0; gi < 3; gi++) {
      R++;
      ws.getRow(R).height = 12;
      for (let c = 0; c < NCOLS; c++) {
        const cell = ws.getCell(`${colLetter(c)}${R}`);
        cell.fill   = fill(OFF_WHITE);
        cell.border = border();
      }
      // Pre-llenar coefs
      numCell(ws.getCell(`L${R}`), cp, OFF_WHITE, '0.0000');
      numCell(ws.getCell(`J${R}`), DEFL_COEF, ORANGE, '0.00');
      numCell(ws.getCell(`N${R}`), co, OFF_WHITE, '0.00');
      numCell(ws.getCell(`O${R}`), 0, YELLOW, '#,##0.00', NAVY, true);
      numCell(ws.getCell(`P${R}`), 0, YELLOW, '#,##0.00', NAVY, true);
    }

    R++;
    ws.getRow(R).height = 4;

    // ── TOTAL PRESUPUESTO ─────────────────────────────────────────────────────
    R++;
    ws.getRow(R).height = 22;
    ws.mergeCells(`A${R}:O${R}`);
    const totCell = ws.getCell(`A${R}`);
    totCell.value     = 'TOTAL PRESUPUESTO';
    totCell.fill      = fill(TOTAL_BG);
    totCell.font      = font(true, WHITE, 12);
    totCell.alignment = { horizontal: 'left', vertical: 'middle' };
    totCell.border    = borderMedium();

    const grandCell = ws.getCell(`P${R}`);
    grandCell.value     = grandTotal;
    grandCell.numFmt    = '#,##0.00';
    grandCell.fill      = fill(TOTAL_BG);
    grandCell.font      = font(true, 'F59E0B', 12);  // amarillo/dorado
    grandCell.alignment = { horizontal: 'right', vertical: 'middle' };
    grandCell.border    = borderMedium();

    for (let c = 16; c < NCOLS; c++) {
      ws.getCell(`${colLetter(c)}${R}`).fill = fill(TOTAL_BG);
      ws.getCell(`${colLetter(c)}${R}`).border = borderMedium();
    }

    // ── NOTAS ─────────────────────────────────────────────────────────────────
    if (form.notas) {
      R += 2;
      ws.getRow(R).height = 14;
      ws.mergeCells(`A${R}:${colLetter(NCOLS-1)}${R}`);
      ws.getCell(`A${R}`).value = `NOTAS: ${form.notas}`;
      ws.getCell(`A${R}`).font = font(false, '607D8B', 8, true);
    }

    // Congelar encabezado (debajo de los metadatos = fila 13 aprox)
    ws.views = [{ state: 'frozen', ySplit: R < 15 ? 12 : 12, xSplit: 2 }];

    // ── Exportar y subir ──────────────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer();
    const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file: buffer });

    return Response.json({
      success: true,
      file_url: uploadResult.file_url,
      filename: `PCP_${form.codigo || form.titulo}_MEJORES.xlsx`
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});