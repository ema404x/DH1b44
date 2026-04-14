import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import ExcelJS from 'npm:exceljs@4.4.0';

// ─────────────────────────────────────────────────────────────────────────────
// REPLICA EXACTA del Excel ministerial MEJORES HOSPITALES S.A.
// Hoja PCP + Hoja PLAN DE TRABAJOS + Hoja ORDEN TAREAS
// ─────────────────────────────────────────────────────────────────────────────

const LOGO_URL = 'https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/b6844473f_mejores_cover.jpg';

// Colores exactos del Excel original
const C_NAVY     = '0F1C2E';  // header principal, total general
const C_NAVY2    = '1A3A5C';  // labels metadatos
const C_BLUE_H   = '1F4E79';  // encabezado tabla (azul oscuro)
const C_BLUE_S   = 'BDD7EE';  // sub-encabezado tabla
const C_UBIC     = '2E75B6';  // fila UBICACIÓN (azul medio)
const C_RUBRO    = 'DAEEF3';  // fila RUBRO (celeste claro)
const C_RUBRO_F  = '17375E';  // fuente rubro
const C_ITEM_ALT = 'EBF4FB';  // filas alternas ítems
const C_ITEM_NOR = 'FFFFFF';  // filas normales ítems
const C_DEFL_BG  = 'FCE4D6';  // deflación - fondo naranja claro
const C_YELLOW   = 'FFFF99';  // precio resultante / subtotal — amarillo
const C_GREEN    = 'E2EFDA';  // subtotal rubro — verde
const C_TOTAL_BG = '0F1C2E';  // fila TOTAL PRESUPUESTO
const C_WHITE    = 'FFFFFF';
const C_GRAY_L   = 'F2F2F2';  // generales row bg
const C_PLAN_DAY = 'BDD7EE';  // días plan de trabajos

async function loadLogo() {
  try {
    const res = await fetch(LOGO_URL);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch { return null; }
}

function fill(hex) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${hex}` } };
}

function fnt(bold, hex, size = 9, italic = false) {
  return { bold, italic, color: { argb: `FF${hex}` }, size, name: 'Arial' };
}

function bdr(hex = 'B0BEC5', style = 'thin') {
  const s = { style, color: { argb: `FF${hex}` } };
  return { top: s, bottom: s, left: s, right: s };
}

function bdrMed(hex = '1F4E79') {
  const s = { style: 'medium', color: { argb: `FF${hex}` } };
  return { top: s, bottom: s, left: s, right: s };
}

function align(h = 'center', v = 'middle', wrap = false) {
  return { horizontal: h, vertical: v, wrapText: wrap };
}

function setCell(cell, val, fillHex, fontBold, fontHex, fontSize, halign, wrap = false, numFmt = null, italic = false) {
  cell.value     = val === '' ? null : val;
  cell.fill      = fill(fillHex);
  cell.font      = fnt(fontBold, fontHex, fontSize, italic);
  cell.alignment = align(halign, 'middle', wrap);
  cell.border    = bdr();
  if (numFmt) cell.numFmt = numFmt;
}

function fmtDate(d) {
  if (!d) return '';
  try { const p = d.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; } catch { return d || ''; }
}

// ═══════════════════════════════════════════════════════════════════════════
// HOJA PCP
// Estructura exacta: 21 columnas A..U
// A=ITEM PRESUP, B=ITEM PRECIARIO, C=DESCRIPCIÓN
// D=UNID, E=CANT
// F=P.U.MAT, G=P.U.MO, H=TOTAL
// I=PRECIO ACTUAL SIN IVA, J=COEF DEFLACTOR, K=PRECIO DEFLACIONADO
// L=COEF PASE, M=TOTAL PASE
// N=COEF OFERTA, O=PRECIO RESULTANTE
// P=SUBTOTAL
// Q=%, R=ANTERIOR, S=ACTUAL, T=ACUMULADO, U=(vacío)
// ═══════════════════════════════════════════════════════════════════════════
function buildPCP(wb, form, logoBuffer) {
  const ws = wb.addWorksheet('PCP', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, paperSize: 9 }
  });

  const cp = Number(form.coef_pase)   || 1.6504;
  const co = Number(form.coef_oferta) || 1.38;
  const DEFL = 6.37;

  // Anchos de columna exactos del Excel original
  ws.columns = [
    { width: 9  }, // A ITEM PRESUP
    { width: 13 }, // B ITEM PRECIARIO
    { width: 50 }, // C DESCRIPCIÓN
    { width: 7  }, // D UNID
    { width: 10 }, // E CANT
    { width: 14 }, // F PU MAT
    { width: 14 }, // G PU MO
    { width: 14 }, // H TOTAL PU
    { width: 16 }, // I PRECIO ACTUAL SIN IVA
    { width: 10 }, // J COEF DEFLACTOR
    { width: 14 }, // K PRECIO DEFLACIONADO
    { width: 10 }, // L COEF PASE
    { width: 14 }, // M TOTAL PASE
    { width: 10 }, // N COEF OFERTA
    { width: 16 }, // O PRECIO RESULTANTE
    { width: 14 }, // P SUBTOTAL
    { width: 8  }, // Q %
    { width: 12 }, // R ANTERIOR
    { width: 12 }, // S ACTUAL
    { width: 12 }, // T ACUMULADO
    { width: 5  }, // U vacío
  ];

  let R = 0;
  function row(h) { R++; ws.getRow(R).height = h; return R; }
  function C(col) { return ws.getCell(`${col}${R}`); }
  function merge(a, b) { ws.mergeCells(`${a}${R}:${b}${R}`); }

  // ── Fila 1: Logo + Título ────────────────────────────────────────────────
  row(50);
  merge('A', 'U');
  C('A').fill = fill(C_NAVY);

  if (logoBuffer) {
    const imgId = wb.addImage({ buffer: logoBuffer, extension: 'jpeg' });
    ws.addImage(imgId, { tl: { col: 0, row: 0 }, br: { col: 4, row: 1 }, editAs: 'oneCell' });
  }

  // ── Fila 2: PLANILLA DE CÓMPUTO Y PRESUPUESTO ───────────────────────────
  row(20);
  merge('A', 'U');
  const titleCell = C('A');
  titleCell.value = 'PLANILLA DE CÒMPUTO Y PRESUPUESTO';
  titleCell.fill  = fill(C_NAVY);
  titleCell.font  = fnt(true, C_WHITE, 13);
  titleCell.alignment = align('center');

  // ── Fila 3: COMITENTE ───────────────────────────────────────────────────
  row(14);
  C('A').value = 'COMITENTE'; C('A').font = fnt(true, C_NAVY2, 9); merge('A', 'C');
  C('D').value = form.cliente_nombre || 'GCBA - MINISTERIO DE EDUCACIÓN DE LA CIUDAD DE BUENOS AIRES - DGMESC';
  C('D').font  = fnt(false, '000000', 9); merge('D', 'U');

  // ── Fila 4: LICITACIÓN ──────────────────────────────────────────────────
  row(14);
  C('A').value = 'LICITACIÓN'; C('A').font = fnt(true, C_NAVY2, 9); merge('A', 'C');
  C('D').value = form.licitacion || ''; C('D').font = fnt(false, '000000', 9); merge('D', 'U');

  // ── Fila 5: vacía ───────────────────────────────────────────────────────
  row(6);
  merge('A', 'U'); C('A').fill = fill(C_WHITE);

  // ── Fila 6: Zona + Empresa | Nº Presupuesto ─────────────────────────────
  row(14);
  merge('A', 'B'); C('A').value = form.comuna || '8 A'; C('A').font = fnt(true, C_NAVY2, 10);
  merge('C', 'K'); C('C').value = 'EMPRESA: MEJORES HOSPITALES S.A.'; C('C').font = fnt(true, C_NAVY, 9);
  merge('L', 'N'); C('L').value = 'Nº PRESUPUESTO'; C('L').font = fnt(true, C_NAVY2, 9);
  merge('O', 'U'); C('O').value = form.codigo || ''; C('O').font = fnt(false, '000000', 9);

  // ── Fila 7: Dirección | Fecha ingreso SAP ───────────────────────────────
  row(14);
  merge('C', 'K'); C('C').value = `DIRECCIÓN: ${form.direccion_obra || ''}`; C('C').font = fnt(false, '000000', 9);
  merge('L', 'N'); C('L').value = 'FECHA ingreso sap'; C('L').font = fnt(true, C_NAVY2, 9);
  merge('O', 'U'); C('O').value = fmtDate(form.fecha_emision); C('O').font = fnt(false, '000000', 9);

  // ── Fila 8: Escuela | Plazo ─────────────────────────────────────────────
  row(14);
  merge('C', 'K'); C('C').value = `ESCUELA: ${form.proyecto_nombre || ''}`; C('C').font = fnt(false, '000000', 9);
  merge('L', 'N'); C('L').value = 'PLAZO'; C('L').font = fnt(true, C_NAVY2, 9);
  merge('O', 'U'); C('O').value = form.plazo || ''; C('O').font = fnt(false, '000000', 9);

  // ── Fila 9: Obra | Preciario ─────────────────────────────────────────────
  row(14);
  merge('C', 'K'); C('C').value = `OBRA: ${form.titulo || ''}`; C('C').font = fnt(false, '000000', 9);
  merge('L', 'N'); C('L').value = 'Preciario Utilizado'; C('L').font = fnt(true, C_NAVY2, 9);
  merge('O', 'U'); C('O').value = fmtDate(form.preciario_fecha) || '01/02/2023'; C('O').font = fnt(false, '000000', 9);

  // ── Fila 10: Coef Pase ──────────────────────────────────────────────────
  row(14);
  merge('L', 'N'); C('L').value = 'Coef. Pase'; C('L').font = fnt(true, C_NAVY2, 9);
  merge('O', 'P'); C('O').value = cp; C('O').numFmt = '0.0000'; C('O').font = fnt(false, '000000', 9);

  // ── Fila 11: MTOM + Supervisor + Inspector | Coef Oferta ────────────────
  row(14);
  merge('A', 'B'); C('A').value = 'MTOM Nº'; C('A').font = fnt(true, C_NAVY2, 9);
  merge('C', 'G'); C('C').value = `SUPERVISOR: ${form.responsable || ''}`; C('C').font = fnt(false, '000000', 9);
  merge('H', 'K'); C('H').value = 'INSPECTOR: '; C('H').font = fnt(false, '000000', 9);
  merge('L', 'N'); C('L').value = 'Coef. Oferta'; C('L').font = fnt(true, C_NAVY2, 9);
  merge('O', 'P'); C('O').value = co; C('O').numFmt = '0.00'; C('O').font = fnt(false, '000000', 9);

  // ── Fila 12: separador ──────────────────────────────────────────────────
  row(5);
  merge('A', 'U'); C('A').fill = fill(C_WHITE);

  // ── Fila 13: Encabezado tabla — grupos ──────────────────────────────────
  row(28);
  const H1 = [
    ['A', 'A', 'ITEM\nPRESUP'],
    ['B', 'B', 'ITEM\nPRECIARIO'],
    ['C', 'C', 'DESCRIPCIÓN'],
    ['D', 'E', 'CÓMPUTO'],
    ['F', 'H', 'PRECIOS UNITARIOS'],
    ['I', 'K', 'DEFLACIÓN DE MATERIALES\nFUERA DE PRECIARIO'],
    ['L', 'M', 'COEFICIENTE\nDE PASE'],
    ['N', 'N', 'COEFICIENTE\nOFERTA'],
    ['O', 'O', 'PRECIO\nRESULTANTE'],
    ['P', 'P', 'SUBTOTAL'],
    ['Q', 'Q', '% AVANCE'],
    ['R', 'T', 'AVANCE'],
    ['U', 'U', ''],
  ];
  for (const [c1, c2, lbl] of H1) {
    const ref = c1 === c2 ? `${c1}${R}` : `${c1}${R}:${c2}${R}`;
    if (c1 !== c2) ws.mergeCells(ref);
    const cell = ws.getCell(`${c1}${R}`);
    cell.value = lbl;
    cell.fill  = fill(C_BLUE_H);
    cell.font  = fnt(true, C_WHITE, 8);
    cell.alignment = align('center', 'middle', true);
    cell.border = bdr(C_WHITE);
  }

  // ── Fila 14: Encabezado tabla — sub-columnas ────────────────────────────
  row(24);
  const H2 = [
    ['A','',false], ['B','',false], ['C','',false],
    ['D','UNID.',true], ['E','CANT.',true],
    ['F','P.U.MAT.',true], ['G','P.U.M.O.',true], ['H','TOTAL',true],
    ['I','PRECIO ACTUAL\nSIN IVA',true], ['J','COEFICIENTE\nDEFLACTOR',true], ['K','PRECIO\nDEFLACIONADO',true],
    ['L','COEFICIENTE',true], ['M','TOTAL',true],
    ['N','COEFICIENTE',true], ['O','PRECIO\nRESULTANTE',true],
    ['P','',false],
    ['Q','',false], ['R','ANTERIOR',true], ['S','ACTUAL',true], ['T','ACUMULADO',true],
    ['U','',false],
  ];
  for (const [col, lbl] of H2) {
    const cell = ws.getCell(`${col}${R}`);
    cell.value = lbl;
    cell.fill  = fill(C_BLUE_S);
    cell.font  = fnt(true, C_BLUE_H, 7.5);
    cell.alignment = align('center', 'middle', true);
    cell.border = bdr(C_BLUE_H);
  }

  // ── ÍTEMS ────────────────────────────────────────────────────────────────
  const rubros = form.rubros || [];
  let itemNum = 1;
  let grandTotal = 0;

  for (const rubro of rubros) {
    let rubroTotal = 0;

    // Fila RUBRO
    row(15);
    ws.mergeCells(`A${R}:U${R}`);
    const rbCell = ws.getCell(`A${R}`);
    rbCell.value     = `  ${(rubro.nombre || '').toUpperCase()}`;
    rbCell.fill      = fill(C_RUBRO);
    rbCell.font      = fnt(true, C_RUBRO_F, 9);
    rbCell.alignment = align('left', 'middle');
    rbCell.border    = bdrMed();

    for (const item of (rubro.items || [])) {
      row(13);
      const pu_mat   = Number(item.pu_mat)   || 0;
      const pu_mo    = Number(item.pu_mo)    || 0;
      const pu_total = pu_mat + pu_mo;
      const tot_pase = pu_total * cp;
      const p_result = tot_pase * co;
      const subtotal = p_result * (Number(item.cantidad) || 0);

      rubroTotal += subtotal;
      grandTotal += subtotal;

      const bg = itemNum % 2 === 0 ? C_ITEM_ALT : C_ITEM_NOR;

      // A: ítem
      setCell(ws.getCell(`A${R}`), itemNum, bg, false, '1D1D1D', 8, 'center');
      // B: código
      setCell(ws.getCell(`B${R}`), item.codigo || '', bg, false, '1D1D1D', 8, 'center');
      // C: descripción
      setCell(ws.getCell(`C${R}`), item.descripcion || '', bg, false, '1D1D1D', 8, 'left', true);
      // D: unidad
      setCell(ws.getCell(`D${R}`), item.unidad || '', bg, false, '1D1D1D', 8, 'center');
      // E: cantidad
      setCell(ws.getCell(`E${R}`), Number(item.cantidad) || 0, bg, false, '1D1D1D', 8, 'right', false, '0.00');
      // F: PU MAT
      setCell(ws.getCell(`F${R}`), pu_mat || null, bg, false, '1D1D1D', 8, 'right', false, '#,##0.00');
      // G: PU MO
      setCell(ws.getCell(`G${R}`), pu_mo || null, bg, false, '1D1D1D', 8, 'right', false, '#,##0.00');
      // H: TOTAL PU
      setCell(ws.getCell(`H${R}`), pu_total || null, bg, true, C_NAVY, 8, 'right', false, '#,##0.00');
      // I: Deflación precio actual sin IVA
      setCell(ws.getCell(`I${R}`), 0, C_DEFL_BG, false, '808080', 8, 'right', false, '#,##0.00');
      // J: Coef deflactor
      setCell(ws.getCell(`J${R}`), DEFL, C_DEFL_BG, false, '808080', 8, 'right', false, '0.00');
      // K: Precio deflacionado
      setCell(ws.getCell(`K${R}`), 0, C_DEFL_BG, false, '808080', 8, 'right', false, '#,##0.00');
      // L: Coef pase
      setCell(ws.getCell(`L${R}`), cp, bg, false, '1D1D1D', 8, 'right', false, '0.0000');
      // M: Total pase
      setCell(ws.getCell(`M${R}`), tot_pase || null, bg, false, '1D1D1D', 8, 'right', false, '#,##0.00');
      // N: Coef oferta
      setCell(ws.getCell(`N${R}`), co, bg, false, '1D1D1D', 8, 'right', false, '0.00');
      // O: Precio resultante — amarillo
      setCell(ws.getCell(`O${R}`), p_result || null, C_YELLOW, true, C_NAVY, 8, 'right', false, '#,##0.00');
      // P: Subtotal — amarillo
      setCell(ws.getCell(`P${R}`), subtotal || null, C_YELLOW, true, C_NAVY, 8, 'right', false, '#,##0.00');
      // Q: % avance
      setCell(ws.getCell(`Q${R}`), null, C_ITEM_NOR, false, '808080', 8, 'right', false, '0%');
      // R, S, T: avance
      setCell(ws.getCell(`R${R}`), null, C_ITEM_NOR, false, '808080', 8, 'right', false, '#,##0.00');
      setCell(ws.getCell(`S${R}`), null, C_ITEM_NOR, false, '808080', 8, 'right', false, '#,##0.00');
      setCell(ws.getCell(`T${R}`), null, C_ITEM_NOR, false, '808080', 8, 'right', false, '#,##0.00');
      // U vacío
      ws.getCell(`U${R}`).fill = fill(C_ITEM_NOR); ws.getCell(`U${R}`).border = bdr();

      itemNum++;
    }

    // Subtotal rubro — verde
    row(14);
    ws.mergeCells(`A${R}:O${R}`);
    const stLabel = ws.getCell(`A${R}`);
    stLabel.value     = `  Subtotal ${rubro.nombre || ''}`;
    stLabel.fill      = fill(C_GREEN);
    stLabel.font      = fnt(true, C_RUBRO_F, 9, true);
    stLabel.alignment = align('left', 'middle');
    stLabel.border    = bdrMed();

    const stVal = ws.getCell(`P${R}`);
    stVal.value     = rubroTotal || null;
    stVal.numFmt    = '#,##0.00';
    stVal.fill      = fill(C_GREEN);
    stVal.font      = fnt(true, C_NAVY, 9);
    stVal.alignment = align('right', 'middle');
    stVal.border    = bdrMed();

    for (const col of ['Q','R','S','T','U']) {
      ws.getCell(`${col}${R}`).fill = fill(C_GREEN);
      ws.getCell(`${col}${R}`).border = bdr();
    }

    row(4); ws.mergeCells(`A${R}:U${R}`); ws.getCell(`A${R}`).fill = fill(C_WHITE);
  }

  // ── GENERALES - VOLQUETES ─────────────────────────────────────────────────
  row(15);
  ws.mergeCells(`A${R}:U${R}`);
  const genCell = ws.getCell(`A${R}`);
  genCell.value = 'GENERALES - VOLQUETES - ANDAMIOS - LIMPIEZA DE OBRA';
  genCell.fill  = fill(C_UBIC);
  genCell.font  = fnt(true, C_WHITE, 9);
  genCell.alignment = align('left');
  genCell.border = bdrMed();

  // 7 filas vacías para generales
  const genItems = ['Andamios','Armado Andamios','Volquetes','Acarreo de materiales','Limpieza de Obra','Tramitaciones','Otros'];
  for (const gNombre of genItems) {
    row(13);
    setCell(ws.getCell(`A${R}`), '', C_GRAY_L, false, '1D1D1D', 8, 'center');
    setCell(ws.getCell(`B${R}`), '', C_GRAY_L, false, '1D1D1D', 8, 'center');
    setCell(ws.getCell(`C${R}`), gNombre, C_GRAY_L, false, '1D1D1D', 8, 'left');
    setCell(ws.getCell(`D${R}`), '', C_GRAY_L, false, '1D1D1D', 8, 'center');
    setCell(ws.getCell(`E${R}`), null, C_GRAY_L, false, '1D1D1D', 8, 'right', false, '0.00');
    setCell(ws.getCell(`F${R}`), null, C_GRAY_L, false, '1D1D1D', 8, 'right', false, '#,##0.00');
    setCell(ws.getCell(`G${R}`), null, C_GRAY_L, false, '1D1D1D', 8, 'right', false, '#,##0.00');
    setCell(ws.getCell(`H${R}`), null, C_GRAY_L, false, '1D1D1D', 8, 'right', false, '#,##0.00');
    setCell(ws.getCell(`I${R}`), null, C_DEFL_BG, false, '808080', 8, 'right', false, '#,##0.00');
    setCell(ws.getCell(`J${R}`), DEFL, C_DEFL_BG, false, '808080', 8, 'right', false, '0.00');
    setCell(ws.getCell(`K${R}`), null, C_DEFL_BG, false, '808080', 8, 'right', false, '#,##0.00');
    setCell(ws.getCell(`L${R}`), cp, C_GRAY_L, false, '1D1D1D', 8, 'right', false, '0.0000');
    setCell(ws.getCell(`M${R}`), null, C_GRAY_L, false, '1D1D1D', 8, 'right', false, '#,##0.00');
    setCell(ws.getCell(`N${R}`), co, C_GRAY_L, false, '1D1D1D', 8, 'right', false, '0.00');
    setCell(ws.getCell(`O${R}`), null, C_YELLOW, true, C_NAVY, 8, 'right', false, '#,##0.00');
    setCell(ws.getCell(`P${R}`), null, C_YELLOW, true, C_NAVY, 8, 'right', false, '#,##0.00');
    for (const col of ['Q','R','S','T','U']) {
      ws.getCell(`${col}${R}`).fill = fill(C_ITEM_NOR); ws.getCell(`${col}${R}`).border = bdr();
    }
  }

  row(4); ws.mergeCells(`A${R}:U${R}`); ws.getCell(`A${R}`).fill = fill(C_WHITE);

  // ── TOTAL PRESUPUESTO ─────────────────────────────────────────────────────
  row(22);
  ws.mergeCells(`A${R}:O${R}`);
  const totCell = ws.getCell(`A${R}`);
  totCell.value     = 'TOTAL PRESUPUESTO';
  totCell.fill      = fill(C_TOTAL_BG);
  totCell.font      = fnt(true, C_WHITE, 12);
  totCell.alignment = align('left', 'middle');
  totCell.border    = bdrMed();

  const grandCell = ws.getCell(`P${R}`);
  grandCell.value     = grandTotal || null;
  grandCell.numFmt    = '#,##0.00';
  grandCell.fill      = fill(C_TOTAL_BG);
  grandCell.font      = fnt(true, 'F59E0B', 12); // dorado
  grandCell.alignment = align('right', 'middle');
  grandCell.border    = bdrMed();

  for (const col of ['Q','R','S','T','U']) {
    ws.getCell(`${col}${R}`).fill = fill(C_TOTAL_BG);
    ws.getCell(`${col}${R}`).border = bdrMed();
  }

  // ── REDETERMINACIÓN (bloque informativo) ──────────────────────────────────
  row(8); ws.mergeCells(`A${R}:U${R}`); ws.getCell(`A${R}`).fill = fill(C_WHITE);
  row(8); ws.mergeCells(`A${R}:U${R}`); ws.getCell(`A${R}`).fill = fill(C_WHITE);

  row(14);
  const redLabel = ws.getCell(`C${R}`);
  redLabel.value = 'REDETERMINACION'; redLabel.font = fnt(true, C_NAVY2, 9);
  ws.getCell(`H${R}`).value = 'Costo de obra a valor actual';
  ws.getCell(`H${R}`).font = fnt(false, '1D1D1D', 9);
  ws.getCell(`I${R}`).value = grandTotal || 0;
  ws.getCell(`I${R}`).numFmt = '#,##0.00';
  ws.getCell(`I${R}`).font = fnt(false, '1D1D1D', 9);

  row(14);
  ws.getCell(`H${R}`).value = 'Precio venta mínimo a valores con base contractual';
  ws.getCell(`H${R}`).font = fnt(false, '1D1D1D', 9);

  // Notas
  if (form.notas) {
    row(4);
    row(14);
    ws.mergeCells(`A${R}:U${R}`);
    ws.getCell(`A${R}`).value = `NOTAS: ${form.notas}`;
    ws.getCell(`A${R}`).font = fnt(false, '607D8B', 8, true);
  }

  // Congelar encabezados
  ws.views = [{ state: 'frozen', ySplit: 14, xSplit: 2 }];
}

// ═══════════════════════════════════════════════════════════════════════════
// HOJA PLAN DE TRABAJOS
// Estructura: misma cabecera + tabla de rubros con columnas de días (1..30+)
// ═══════════════════════════════════════════════════════════════════════════
function buildPlanTrabajos(wb, form, logoBuffer) {
  const ws = wb.addWorksheet('PLAN DE TRABAJOS', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, paperSize: 9 }
  });

  // Columnas: A..D = info rubro (ítems), E en adelante = días 1..N
  const plazoText = form.plazo || '';
  const plazoNum = parseInt(plazoText) || 30;
  const DIAS = Math.max(plazoNum, 30);

  // Columna A..D fijas + E..E+DIAS-1 para días
  const colWidths = [
    { width: 10 }, // A: ítem
    { width: 13 }, // B: código
    { width: 45 }, // C: descripción
    { width: 10 }, // D: subtotal
  ];
  for (let d = 0; d < DIAS; d++) colWidths.push({ width: 4 }); // días
  ws.columns = colWidths;

  let R = 0;
  function row(h) { R++; ws.getRow(R).height = h; return R; }
  function C(col) {
    if (typeof col === 'number') return ws.getCell(col, R);
    return ws.getCell(`${col}${R}`);
  }
  function mergeAB(a, b) { ws.mergeCells(`${a}${R}:${b}${R}`); }
  function colLetter(i) {
    if (i < 26) return String.fromCharCode(65 + i);
    return String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26));
  }
  const lastDayCol = colLetter(3 + DIAS); // D=col3, días empiezan en col4

  // ── Fila 1: Logo + Título ────────────────────────────────────────────────
  row(50);
  ws.mergeCells(`A${R}:${lastDayCol}${R}`);
  ws.getCell(`A${R}`).fill = fill(C_NAVY);

  if (logoBuffer) {
    const imgId = wb.addImage({ buffer: logoBuffer, extension: 'jpeg' });
    ws.addImage(imgId, { tl: { col: 0, row: 0 }, br: { col: 4, row: 1 }, editAs: 'oneCell' });
  }

  // ── Fila 2: Título ──────────────────────────────────────────────────────
  row(20);
  ws.mergeCells(`A${R}:${lastDayCol}${R}`);
  const t = ws.getCell(`A${R}`);
  t.value = 'PLAN DE TRABAJOS'; t.fill = fill(C_NAVY);
  t.font = fnt(true, C_WHITE, 13); t.alignment = align('center');

  // ── Filas de metadatos (igual que PCP) ───────────────────────────────────
  const meta = [
    [['COMITENTE', true], [form.cliente_nombre || 'GCBA - MINISTERIO DE EDUCACIÓN DE LA CIUDAD DE BUENOS AIRES - DGMESC', false]],
    [['LICITACIÒN', true], [form.licitacion || '', false]],
    [['', false], ['', false]],
    [['8 A', true], [`EMPRESA: MEJORES HOSPITALES S.A.`, true], ['Nº PRESUPUESTO', true], [form.codigo || '', false]],
    [['', false], [`DIRECCIÓN: ${form.direccion_obra || ''}`, false], ['FECHA ingreso sap', true], [fmtDate(form.fecha_emision), false]],
    [['', false], [`ESCUELA: ${form.proyecto_nombre || ''}`, false], ['', false], ['', false]],
    [['', false], [`OBRA: ${form.titulo || ''}`, false], ['', false], ['', false]],
    [['', false], ['', false], ['', false], ['', false]],
    [['MTOM Nº', true], [`SUPERVISOR: ${form.responsable || ''}`, false], ['INSPECTOR: ', false], ['', false]],
  ];

  for (const rowData of meta) {
    row(14);
    if (rowData.length === 2) {
      const [l, v] = rowData;
      ws.mergeCells(`A${R}:D${R}`);
      ws.getCell(`A${R}`).value = l[0]; ws.getCell(`A${R}`).font = fnt(l[1], l[1] ? C_NAVY2 : '000000', 9);
      ws.mergeCells(`E${R}:${lastDayCol}${R}`);
      ws.getCell(`E${R}`).value = v[0]; ws.getCell(`E${R}`).font = fnt(v[1], '000000', 9);
    } else {
      // zona + empresa | nº presup
      ws.mergeCells(`A${R}:B${R}`);
      ws.getCell(`A${R}`).value = rowData[0][0]; ws.getCell(`A${R}`).font = fnt(rowData[0][1], C_NAVY2, 10);
      ws.getCell(`C${R}`).value = rowData[1][0]; ws.getCell(`C${R}`).font = fnt(rowData[1][1], C_NAVY, 9);
      ws.getCell(`D${R}`).value = rowData[2][0]; ws.getCell(`D${R}`).font = fnt(rowData[2][1], C_NAVY2, 9);
      ws.mergeCells(`E${R}:${lastDayCol}${R}`);
      ws.getCell(`E${R}`).value = rowData[3][0]; ws.getCell(`E${R}`).font = fnt(rowData[3][1], '000000', 9);
    }
  }

  // ── Separador ────────────────────────────────────────────────────────────
  row(5); ws.mergeCells(`A${R}:${lastDayCol}${R}`); ws.getCell(`A${R}`).fill = fill(C_WHITE);

  // ── Encabezado PLAN DE TRABAJOS ──────────────────────────────────────────
  row(18);
  ws.mergeCells(`A${R}:${lastDayCol}${R}`);
  const ptH = ws.getCell(`A${R}`);
  ptH.value = 'PLAN DE TRABAJOS'; ptH.fill = fill(C_NAVY);
  ptH.font = fnt(true, C_WHITE, 11); ptH.alignment = align('center');

  // ── Fila de DÍAS ─────────────────────────────────────────────────────────
  row(18);
  ws.mergeCells(`A${R}:D${R}`);
  const diasLabel = ws.getCell(`A${R}`);
  diasLabel.value = 'DÍAS'; diasLabel.fill = fill(C_BLUE_H);
  diasLabel.font = fnt(true, C_WHITE, 9); diasLabel.alignment = align('center');
  diasLabel.border = bdr(C_WHITE);

  for (let d = 1; d <= DIAS; d++) {
    const col = colLetter(3 + d); // E=col4=index4, pero colLetter(4)=E
    const cell = ws.getCell(`${col}${R}`);
    cell.value = d;
    cell.fill  = fill(C_PLAN_DAY);
    cell.font  = fnt(true, C_NAVY, 8);
    cell.alignment = align('center');
    cell.border = bdr(C_BLUE_H);
  }

  // ── Ítems (rubros) ───────────────────────────────────────────────────────
  const rubros = form.rubros || [];

  for (const rubro of rubros) {
    // Fila RUBRO header
    row(14);
    ws.mergeCells(`A${R}:${lastDayCol}${R}`);
    const rbH = ws.getCell(`A${R}`);
    rbH.value = `  ${(rubro.nombre || '').toUpperCase()}`;
    rbH.fill  = fill(C_RUBRO); rbH.font = fnt(true, C_RUBRO_F, 9);
    rbH.alignment = align('left'); rbH.border = bdrMed();

    for (const item of (rubro.items || [])) {
      row(13);
      // A: descripción
      ws.mergeCells(`A${R}:D${R}`);
      const descCell = ws.getCell(`A${R}`);
      descCell.value = item.descripcion || '';
      descCell.fill  = fill(C_ITEM_NOR);
      descCell.font  = fnt(false, '1D1D1D', 8);
      descCell.alignment = align('left', 'middle', true);
      descCell.border = bdr();

      // Días: celdas vacías para marcar manualmente
      for (let d = 1; d <= DIAS; d++) {
        const col = colLetter(3 + d);
        const cell = ws.getCell(`${col}${R}`);
        cell.fill   = fill(d % 7 === 0 || d % 7 === 6 ? C_ITEM_ALT : C_ITEM_NOR);
        cell.border = bdr('D0D0D0');
      }
    }
  }

  // ── GENERALES (mismas filas) ──────────────────────────────────────────────
  row(14);
  ws.mergeCells(`A${R}:${lastDayCol}${R}`);
  const genH = ws.getCell(`A${R}`);
  genH.value = 'GENERALES - VOLQUETES - ANDAMIOS - LIMPIEZA DE OBRA';
  genH.fill  = fill(C_UBIC); genH.font = fnt(true, C_WHITE, 9);
  genH.alignment = align('left'); genH.border = bdrMed();

  const genItems = ['Andamios','Armado Andamios','Volquetes','Acarreo de materiales','Limpieza de Obra','Tramitaciones','Otros'];
  for (const g of genItems) {
    row(13);
    ws.mergeCells(`A${R}:D${R}`);
    const gc = ws.getCell(`A${R}`);
    gc.value = g; gc.fill = fill(C_GRAY_L);
    gc.font = fnt(false, '1D1D1D', 8); gc.alignment = align('left'); gc.border = bdr();
    for (let d = 1; d <= DIAS; d++) {
      const col = colLetter(3 + d);
      const cell = ws.getCell(`${col}${R}`);
      cell.fill   = fill(d % 7 === 0 || d % 7 === 6 ? C_ITEM_ALT : C_ITEM_NOR);
      cell.border = bdr('D0D0D0');
    }
  }

  ws.views = [{ state: 'frozen', ySplit: 14, xSplit: 4 }];
}

// ═══════════════════════════════════════════════════════════════════════════
// HOJA ORDEN TAREAS
// ═══════════════════════════════════════════════════════════════════════════
function buildOrdenTareas(wb, rubros) {
  const ws = wb.addWorksheet('ORDEN TAREAS');
  ws.columns = [{ width: 6 }, { width: 40 }];

  let R = 0;
  const tareasList = [
    [null, null],
    ...rubros.map((r, i) => [i + 1, (r.nombre || '').toUpperCase()]),
    [null, null],
    [null, 'VOLQUETES'],
    [null, 'LIMPIEZA DE OBRA'],
    [null, 'TRAMITACIONES'],
  ];

  for (const [num, nombre] of tareasList) {
    R++;
    if (num !== null) {
      ws.getCell(`A${R}`).value = num;
      ws.getCell(`A${R}`).font = fnt(true, C_NAVY, 9);
      ws.getCell(`A${R}`).alignment = align('center');
    }
    if (nombre) {
      ws.getCell(`B${R}`).value = nombre;
      ws.getCell(`B${R}`).font = fnt(false, '1D1D1D', 9);
    }
    ws.getRow(R).height = 14;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { presupuestoId } = await req.json();
    if (!presupuestoId) return Response.json({ error: 'presupuestoId requerido' }, { status: 400 });

    const [form] = await base44.entities.PresupuestoObra.filter({ id: presupuestoId });
    if (!form) return Response.json({ error: 'Presupuesto no encontrado' }, { status: 404 });

    const logoBuffer = await loadLogo();

    const wb = new ExcelJS.Workbook();
    wb.creator = 'MEJORES HOSPITALES S.A.';

    buildPCP(wb, form, logoBuffer);
    buildPlanTrabajos(wb, form, logoBuffer);
    buildOrdenTareas(wb, form.rubros || []);

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