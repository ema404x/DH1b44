import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import ExcelJS from 'npm:exceljs@4.4.0';

// ─────────────────────────────────────────────────────────────────────────────
// PALETA EXACTA — idéntica al PDF (mismos valores)
// ─────────────────────────────────────────────────────────────────────────────
const C_NAVY     = '0F1C2E';  // header / total bg
const C_NAVY2    = '1A3A5C';  // labels meta
const C_BLUE_H   = '1F4E79';  // encabezado tabla fila 1 (fuente)
const C_BLUE_S   = 'BDD7EE';  // encabezado tabla fila 2 (bg)
const C_UBIC     = '2E75B6';  // generales header
const C_RUBRO_BG = 'DAEEF3';  // rubro header bg
const C_RUBRO_F  = '17375E';  // rubro font
const C_ALT      = 'EBF4FB';  // fila alterna
const C_DEFL_BG  = 'FCE4D6';  // deflación naranja claro
const C_YELLOW   = 'FFFF99';  // precio resultante / subtotal
const C_GREEN    = 'E2EFDA';  // subtotal rubro
const C_GRAY_L   = 'F2F2F2';  // generales filas
const C_WHITE    = 'FFFFFF';
const C_DARK     = '1D1D1D';
const C_GRAY_T   = '808080';
const LOGO_URL   = 'https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/b6844473f_mejores_cover.jpg';

async function loadLogo() {
  try {
    const r = await fetch(LOGO_URL);
    if (!r.ok) return null;
    return await r.arrayBuffer();
  } catch { return null; }
}

function fill(hex) { return { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${hex}` } }; }
function fnt(bold, hex, size = 9, italic = false) {
  return { bold, italic, color: { argb: `FF${hex}` }, size, name: 'Arial' };
}
function aln(h = 'center', v = 'middle', wrap = false) { return { horizontal: h, vertical: v, wrapText: wrap }; }
function bdr(hex = 'C8C8C8', style = 'thin') {
  const s = { style, color: { argb: `FF${hex}` } };
  return { top: s, bottom: s, left: s, right: s };
}
function bdrMed(hex = C_NAVY2) {
  const s = { style: 'medium', color: { argb: `FF${hex}` } };
  return { top: s, bottom: s, left: s, right: s };
}
function fmtDate(d) {
  if (!d) return '';
  try { const p = d.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; } catch { return d || ''; }
}

// ─── Celda con todos los atributos ────────────────────────────────────────────
function sc(cell, val, fillHex, bold, fontHex, size, halign, wrap = false, numFmt = null, italic = false) {
  cell.value     = (val === '' || val == null) ? null : val;
  cell.fill      = fill(fillHex);
  cell.font      = fnt(bold, fontHex, size, italic);
  cell.alignment = aln(halign, 'middle', wrap);
  cell.border    = bdr();
  if (numFmt) cell.numFmt = numFmt;
}

// ─────────────────────────────────────────────────────────────────────────────
// COLUMNAS: A..T (20 columnas = mismas que el PDF)
// A  ITEM PRESUP  B  ITEM PRECIARIO  C  DESCRIPCIÓN  D  UNID  E  CANT
// F  PU MAT       G  PU MO           H  TOTAL PU
// I  PRECIO ACT   J  COEF DEFL       K  PRECIO DEFL
// L  COEF PASE    M  TOTAL PASE
// N  COEF OFERTA  O  PRECIO RESULT   P  SUBTOTAL
// Q  % AVANCE     R  ANTERIOR        S  ACTUAL       T  ACUMULADO
// ─────────────────────────────────────────────────────────────────────────────
function buildPCP(wb, form, logoBuffer) {
  const ws = wb.addWorksheet('PCP', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, paperSize: 9 }
  });

  ws.columns = [
    { width: 8  }, // A
    { width: 13 }, // B
    { width: 52 }, // C
    { width: 8  }, // D
    { width: 10 }, // E
    { width: 14 }, // F
    { width: 14 }, // G
    { width: 14 }, // H
    { width: 16 }, // I
    { width: 10 }, // J
    { width: 14 }, // K
    { width: 10 }, // L
    { width: 15 }, // M
    { width: 10 }, // N
    { width: 16 }, // O
    { width: 17 }, // P
    { width: 7  }, // Q
    { width: 12 }, // R
    { width: 12 }, // S
    { width: 12 }, // T
  ];

  const cp = Number(form.coef_pase)   || 1.6504;
  const co = Number(form.coef_oferta) || 1.38;

  let R = 0;
  const row  = (h) => { R++; ws.getRow(R).height = h; return R; };
  const cell = (col) => ws.getCell(`${col}${R}`);
  const mrg  = (a, b) => ws.mergeCells(`${a}${R}:${b}${R}`);
  const allCols = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T'];

  // ── Fila 1: Logo + fondo navy ─────────────────────────────────────────────
  row(50); mrg('A','T');
  cell('A').fill = fill(C_NAVY);
  if (logoBuffer) {
    const imgId = wb.addImage({ buffer: logoBuffer, extension: 'jpeg' });
    ws.addImage(imgId, { tl: { col: 0, row: 0 }, br: { col: 4, row: 1 }, editAs: 'oneCell' });
  }

  // ── Fila 2: Título ────────────────────────────────────────────────────────
  row(22); mrg('A','T');
  Object.assign(cell('A'), { value: 'PLANILLA DE CÓMPUTO Y PRESUPUESTO', fill: fill(C_NAVY) });
  cell('A').font = fnt(true, C_WHITE, 14);
  cell('A').alignment = aln('center');

  // ── Metadatos (filas 3..12) ───────────────────────────────────────────────
  // Fila 3: COMITENTE
  row(14); mrg('A','C'); cell('A').value='COMITENTE'; cell('A').font=fnt(true,C_NAVY2,9);
  mrg('D','T'); cell('D').value=form.cliente_nombre||'GCBA - MINISTERIO DE EDUCACIÓN DE LA CIUDAD DE BUENOS AIRES - DGMESC'; cell('D').font=fnt(false,C_DARK,9); cell('D').alignment=aln('left','middle',false);

  // Fila 4: LICITACIÓN
  row(14); mrg('A','C'); cell('A').value='LICITACIÓN'; cell('A').font=fnt(true,C_NAVY2,9);
  mrg('D','T'); cell('D').value=form.licitacion||''; cell('D').font=fnt(false,C_DARK,9); cell('D').alignment=aln('left');

  // Fila 5: vacía
  row(5); mrg('A','T'); cell('A').fill=fill(C_WHITE);

  // Fila 6: Zona + Empresa | Nº Presupuesto
  row(14);
  mrg('A','B'); cell('A').value=form.comuna||'8A'; cell('A').font=fnt(true,C_NAVY2,10);
  mrg('C','K'); cell('C').value='EMPRESA: MEJORES HOSPITALES S.A.'; cell('C').font=fnt(true,C_NAVY,9); cell('C').alignment=aln('left');
  mrg('L','N'); cell('L').value='Nº PRESUPUESTO'; cell('L').font=fnt(true,C_NAVY2,9);
  mrg('O','T'); cell('O').value=form.codigo||''; cell('O').font=fnt(false,C_DARK,9); cell('O').alignment=aln('left');

  // Fila 7: Dirección | Fecha SAP
  row(14);
  mrg('C','K'); cell('C').value=`DIRECCIÓN: ${form.direccion_obra||''}`; cell('C').font=fnt(false,C_DARK,9); cell('C').alignment=aln('left');
  mrg('L','N'); cell('L').value='FECHA ingreso SAP'; cell('L').font=fnt(true,C_NAVY2,9);
  mrg('O','T'); cell('O').value=fmtDate(form.fecha_emision); cell('O').font=fnt(false,C_DARK,9); cell('O').alignment=aln('left');

  // Fila 8: Escuela | Plazo
  row(14);
  mrg('C','K'); cell('C').value=`ESCUELA: ${form.proyecto_nombre||''}`; cell('C').font=fnt(false,C_DARK,9); cell('C').alignment=aln('left');
  mrg('L','N'); cell('L').value='PLAZO'; cell('L').font=fnt(true,C_NAVY2,9);
  mrg('O','T'); cell('O').value=form.plazo?`${form.plazo} días`:''; cell('O').font=fnt(false,C_DARK,9); cell('O').alignment=aln('left');

  // Fila 9: Obra | Preciario
  row(14);
  mrg('C','K'); cell('C').value=`OBRA: ${form.titulo||''}`; cell('C').font=fnt(false,C_DARK,9); cell('C').alignment=aln('left');
  mrg('L','N'); cell('L').value='Preciario Utilizado'; cell('L').font=fnt(true,C_NAVY2,9);
  mrg('O','T'); cell('O').value=fmtDate(form.preciario_fecha)||''; cell('O').font=fnt(false,C_DARK,9); cell('O').alignment=aln('left');

  // Fila 10: Coef Pase
  row(14);
  mrg('L','N'); cell('L').value='Coef. Pase'; cell('L').font=fnt(true,C_NAVY2,9);
  mrg('O','P'); cell('O').value=cp; cell('O').numFmt='0.0000'; cell('O').font=fnt(false,C_DARK,9); cell('O').alignment=aln('left');

  // Fila 11: MTOM + Supervisor + Inspector | Coef Oferta
  row(14);
  mrg('A','B'); cell('A').value='MTOM Nº'; cell('A').font=fnt(true,C_NAVY2,9);
  mrg('C','G'); cell('C').value=`SUPERVISOR: ${form.responsable||''}`; cell('C').font=fnt(false,C_DARK,9); cell('C').alignment=aln('left');
  mrg('H','K'); cell('H').value=`INSPECTOR: ${form.inspector||''}`; cell('H').font=fnt(false,C_DARK,9); cell('H').alignment=aln('left');
  mrg('L','N'); cell('L').value='Coef. Oferta'; cell('L').font=fnt(true,C_NAVY2,9);
  mrg('O','P'); cell('O').value=co; cell('O').numFmt='0.00'; cell('O').font=fnt(false,C_DARK,9); cell('O').alignment=aln('left');

  // Fila 12: separador
  row(5); mrg('A','T'); cell('A').fill=fill(C_WHITE);

  // ── Fila 13: Encabezado tabla — grupos ─────────────────────────────────────
  row(28);
  const grpData = [
    ['A','A','ÍTEM\nPRESUP',   C_WHITE, C_NAVY],
    ['B','B','ÍTEM\nPRECIARIO',C_WHITE, C_NAVY],
    ['C','C','DESCRIPCIÓN',    C_WHITE, C_NAVY],
    ['D','E','CÓMPUTO',        C_WHITE, C_NAVY],
    ['F','H','PRECIOS UNITARIOS', C_WHITE, C_NAVY],
    ['I','K','DEFLACIÓN DE MATERIALES\nFUERA DE PRECIARIO', 'D97B4E', C_DEFL_BG],
    ['L','M','COEFICIENTE\nDE PASE', C_WHITE, C_NAVY],
    ['N','N','COEFICIENTE\nOFERTA',  C_WHITE, C_NAVY],
    ['O','O','PRECIO\nRESULTANTE',   C_WHITE, C_NAVY],
    ['P','P','SUBTOTAL',            C_WHITE, C_NAVY],
    ['Q','Q','% AV.',               C_WHITE, C_NAVY],
    ['R','T','AVANCE',              C_WHITE, C_NAVY],
  ];
  for (const [c1, c2, lbl, fontHex, bgHex] of grpData) {
    const ref = c1===c2 ? `${c1}${R}` : `${c1}${R}:${c2}${R}`;
    if (c1!==c2) ws.mergeCells(ref);
    const cl = ws.getCell(`${c1}${R}`);
    cl.value = lbl;
    cl.fill  = fill(bgHex);
    cl.font  = fnt(true, fontHex, 8);
    cl.alignment = aln('center','middle',true);
    cl.border = bdr(C_WHITE);
  }

  // ── Fila 14: sub-encabezados ────────────────────────────────────────────────
  row(24);
  const subData = [
    ['A', '',                   C_BLUE_S, C_BLUE_H],
    ['B', '',                   C_BLUE_S, C_BLUE_H],
    ['C', '',                   C_BLUE_S, C_BLUE_H],
    ['D', 'UNID.',              C_BLUE_S, C_BLUE_H],
    ['E', 'CANT.',              C_BLUE_S, C_BLUE_H],
    ['F', 'P.U. MAT.',         C_BLUE_S, C_BLUE_H],
    ['G', 'P.U. M.O.',         C_BLUE_S, C_BLUE_H],
    ['H', 'TOTAL',              C_BLUE_S, C_BLUE_H],
    ['I', 'PRECIO ACTUAL\nSIN IVA',    C_DEFL_BG, 'D97B4E'],
    ['J', 'COEFICIENTE\nDEFLACTOR',   C_DEFL_BG, 'D97B4E'],
    ['K', 'PRECIO\nDEFLACIONADO',     C_DEFL_BG, 'D97B4E'],
    ['L', 'COEFICIENTE',       C_BLUE_S, C_BLUE_H],
    ['M', 'TOTAL',             C_BLUE_S, C_BLUE_H],
    ['N', 'COEFICIENTE',       C_BLUE_S, C_BLUE_H],
    ['O', 'PRECIO\nRESULTANTE', C_BLUE_S, C_BLUE_H],
    ['P', '',                  C_BLUE_S, C_BLUE_H],
    ['Q', '',                  C_BLUE_S, C_BLUE_H],
    ['R', 'ANTERIOR',          C_BLUE_S, C_BLUE_H],
    ['S', 'ACTUAL',            C_BLUE_S, C_BLUE_H],
    ['T', 'ACUMULADO',         C_BLUE_S, C_BLUE_H],
  ];
  for (const [col, lbl, bgHex, fntHex] of subData) {
    const cl = ws.getCell(`${col}${R}`);
    cl.value     = lbl;
    cl.fill      = fill(bgHex);
    cl.font      = fnt(true, fntHex, 7.5);
    cl.alignment = aln('center','middle',true);
    cl.border    = bdr(C_BLUE_H);
  }

  // ── ÍTEMS ──────────────────────────────────────────────────────────────────
  let itemNum = 1;
  let grandTotal = 0;

  for (const rubro of (form.rubros || [])) {
    let rubroTotal = 0;

    // Fila RUBRO
    row(15); ws.mergeCells(`A${R}:T${R}`);
    const rb = ws.getCell(`A${R}`);
    rb.value = `  ${(rubro.nombre||'').toUpperCase()}`;
    rb.fill  = fill(C_RUBRO_BG); rb.font = fnt(true,C_RUBRO_F,9);
    rb.alignment = aln('left','middle'); rb.border = bdrMed();

    for (const item of (rubro.items||[])) {
      row(13);
      const pu_mat   = Number(item.pu_mat)   || 0;
      const pu_mo    = Number(item.pu_mo)    || 0;
      const pu_total = pu_mat + pu_mo;
      const tot_pase = pu_total * cp;
      const p_result = tot_pase * co;
      const subtotal = p_result * (Number(item.cantidad)||0);
      rubroTotal += subtotal; grandTotal += subtotal;
      const bg = itemNum % 2 === 0 ? C_ALT : C_WHITE;

      sc(ws.getCell(`A${R}`), itemNum,          bg, false, C_DARK, 8, 'center');
      sc(ws.getCell(`B${R}`), item.codigo||'',  bg, false, C_GRAY_T, 8, 'center');
      sc(ws.getCell(`C${R}`), item.descripcion||'', bg, false, C_DARK, 8, 'left', true);
      sc(ws.getCell(`D${R}`), item.unidad||'',  bg, false, C_DARK, 8, 'center');
      sc(ws.getCell(`E${R}`), Number(item.cantidad)||0, bg, false, C_DARK, 8, 'right', false, '0.00');
      sc(ws.getCell(`F${R}`), pu_mat||null,     bg, false, C_DARK, 8, 'right', false, '#,##0.00');
      sc(ws.getCell(`G${R}`), pu_mo||null,      bg, false, C_DARK, 8, 'right', false, '#,##0.00');
      sc(ws.getCell(`H${R}`), pu_total||null,   bg, true,  C_NAVY, 8, 'right', false, '#,##0.00');
      // I,J,K: deflación
      sc(ws.getCell(`I${R}`), null, C_DEFL_BG, false, C_GRAY_T, 8, 'right', false, '#,##0.00');
      sc(ws.getCell(`J${R}`), 6.37, C_DEFL_BG, false, C_GRAY_T, 8, 'right', false, '0.00');
      sc(ws.getCell(`K${R}`), null, C_DEFL_BG, false, C_GRAY_T, 8, 'right', false, '#,##0.00');
      // L,M: coef pase
      sc(ws.getCell(`L${R}`), cp,       bg, false, C_GRAY_T, 8, 'right', false, '0.0000');
      sc(ws.getCell(`M${R}`), tot_pase||null, bg, false, C_DARK, 8, 'right', false, '#,##0.00');
      // N,O: coef oferta, precio result
      sc(ws.getCell(`N${R}`), co,         bg,      false, C_GRAY_T, 8, 'right', false, '0.00');
      sc(ws.getCell(`O${R}`), p_result||null, C_YELLOW, true, C_NAVY, 8, 'right', false, '#,##0.00');
      // P: subtotal
      sc(ws.getCell(`P${R}`), subtotal||null, C_YELLOW, true, C_NAVY, 8, 'right', false, '#,##0.00');
      // Q,R,S,T: avance
      for (const col of ['Q','R','S','T']) {
        ws.getCell(`${col}${R}`).fill = fill(C_WHITE);
        ws.getCell(`${col}${R}`).border = bdr();
      }
      itemNum++;
    }

    // Subtotal rubro — verde
    row(14); ws.mergeCells(`A${R}:O${R}`);
    const stL = ws.getCell(`A${R}`);
    stL.value = `  Subtotal ${rubro.nombre||''}`; stL.fill = fill(C_GREEN);
    stL.font = fnt(true,C_RUBRO_F,9,true); stL.alignment = aln('left'); stL.border = bdrMed();
    const stV = ws.getCell(`P${R}`);
    stV.value = rubroTotal||null; stV.numFmt='#,##0.00';
    stV.fill = fill(C_GREEN); stV.font = fnt(true,C_NAVY,9);
    stV.alignment = aln('right'); stV.border = bdrMed();
    for (const col of ['Q','R','S','T']) {
      ws.getCell(`${col}${R}`).fill=fill(C_GREEN); ws.getCell(`${col}${R}`).border=bdr();
    }
    row(4); ws.mergeCells(`A${R}:T${R}`); ws.getCell(`A${R}`).fill=fill(C_WHITE);
  }

  // ── GENERALES ───────────────────────────────────────────────────────────────
  row(15); ws.mergeCells(`A${R}:T${R}`);
  const gen = ws.getCell(`A${R}`);
  gen.value='GENERALES - VOLQUETES - ANDAMIOS - LIMPIEZA DE OBRA';
  gen.fill=fill(C_UBIC); gen.font=fnt(true,C_WHITE,9);
  gen.alignment=aln('left'); gen.border=bdrMed();

  const genItems = ['Andamios','Armado Andamios','Volquetes','Acarreo de materiales','Limpieza de Obra','Tramitaciones'];
  for (let gi=0; gi<genItems.length; gi++) {
    row(13);
    const gbg = gi%2===0 ? C_GRAY_L : C_WHITE;
    sc(ws.getCell(`A${R}`),'',             gbg,false,C_DARK,8,'center');
    sc(ws.getCell(`B${R}`),'',             gbg,false,C_DARK,8,'center');
    sc(ws.getCell(`C${R}`),genItems[gi],   gbg,false,C_DARK,8,'left');
    sc(ws.getCell(`D${R}`),'',             gbg,false,C_DARK,8,'center');
    sc(ws.getCell(`E${R}`),null,           gbg,false,C_DARK,8,'right',false,'0.00');
    sc(ws.getCell(`F${R}`),null,           gbg,false,C_DARK,8,'right',false,'#,##0.00');
    sc(ws.getCell(`G${R}`),null,           gbg,false,C_DARK,8,'right',false,'#,##0.00');
    sc(ws.getCell(`H${R}`),null,           gbg,false,C_DARK,8,'right',false,'#,##0.00');
    sc(ws.getCell(`I${R}`),null,     C_DEFL_BG,false,C_GRAY_T,8,'right',false,'#,##0.00');
    sc(ws.getCell(`J${R}`),6.37,    C_DEFL_BG,false,C_GRAY_T,8,'right',false,'0.00');
    sc(ws.getCell(`K${R}`),null,     C_DEFL_BG,false,C_GRAY_T,8,'right',false,'#,##0.00');
    sc(ws.getCell(`L${R}`),cp,             gbg,false,C_GRAY_T,8,'right',false,'0.0000');
    sc(ws.getCell(`M${R}`),null,           gbg,false,C_DARK,8,'right',false,'#,##0.00');
    sc(ws.getCell(`N${R}`),co,             gbg,false,C_GRAY_T,8,'right',false,'0.00');
    sc(ws.getCell(`O${R}`),null,      C_YELLOW,true, C_NAVY, 8,'right',false,'#,##0.00');
    sc(ws.getCell(`P${R}`),null,      C_YELLOW,true, C_NAVY, 8,'right',false,'#,##0.00');
    for (const col of ['Q','R','S','T']) {
      ws.getCell(`${col}${R}`).fill=fill(C_WHITE); ws.getCell(`${col}${R}`).border=bdr();
    }
  }
  row(4); ws.mergeCells(`A${R}:T${R}`); ws.getCell(`A${R}`).fill=fill(C_WHITE);

  // ── TOTAL PRESUPUESTO ────────────────────────────────────────────────────────
  row(22); ws.mergeCells(`A${R}:O${R}`);
  const tot = ws.getCell(`A${R}`);
  tot.value='TOTAL PRESUPUESTO'; tot.fill=fill(C_NAVY);
  tot.font=fnt(true,C_WHITE,12); tot.alignment=aln('left'); tot.border=bdrMed();
  const totV = ws.getCell(`P${R}`);
  totV.value=grandTotal||null; totV.numFmt='#,##0.00';
  totV.fill=fill(C_NAVY); totV.font=fnt(true,'F59E0B',12);
  totV.alignment=aln('right'); totV.border=bdrMed();
  for (const col of ['Q','R','S','T']) {
    ws.getCell(`${col}${R}`).fill=fill(C_NAVY); ws.getCell(`${col}${R}`).border=bdrMed();
  }

  // ── Redeterminación (informativo) ────────────────────────────────────────────
  row(8); ws.mergeCells(`A${R}:T${R}`); ws.getCell(`A${R}`).fill=fill(C_WHITE);
  row(8); ws.mergeCells(`A${R}:T${R}`); ws.getCell(`A${R}`).fill=fill(C_WHITE);
  row(14);
  ws.getCell(`C${R}`).value='REDETERMINACIÓN'; ws.getCell(`C${R}`).font=fnt(true,C_NAVY2,9);
  ws.getCell(`H${R}`).value='Costo de obra a valor actual'; ws.getCell(`H${R}`).font=fnt(false,C_DARK,9);
  ws.getCell(`I${R}`).value=grandTotal||0; ws.getCell(`I${R}`).numFmt='#,##0.00'; ws.getCell(`I${R}`).font=fnt(false,C_DARK,9);
  row(14);
  ws.getCell(`H${R}`).value='Precio venta mínimo a valores con base contractual'; ws.getCell(`H${R}`).font=fnt(false,C_DARK,9);
  ws.mergeCells(`H${R}:T${R}`);

  // Notas
  if (form.notas) {
    row(4); row(13); ws.mergeCells(`A${R}:T${R}`);
    ws.getCell(`A${R}`).value=`NOTAS: ${form.notas}`;
    ws.getCell(`A${R}`).font=fnt(false,'607D8B',8,true);
  }

  // Congelar: encabezados (14 filas) + columnas A y B
  ws.views = [{ state: 'frozen', ySplit: 14, xSplit: 2 }];
}

// ─────────────────────────────────────────────────────────────────────────────
// HOJA PLAN DE TRABAJOS
// ─────────────────────────────────────────────────────────────────────────────
function buildPlanTrabajos(wb, form, logoBuffer) {
  const ws = wb.addWorksheet('PLAN DE TRABAJOS', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, paperSize: 9 }
  });

  const plazoNum = parseInt(form.plazo) || 30;
  const DIAS = Math.max(plazoNum, 30);

  const colWidths = [
    { width: 10 }, // A: ítem #
    { width: 13 }, // B: código
    { width: 48 }, // C: descripción
    { width: 10 }, // D: subtotal
  ];
  for (let d = 0; d < DIAS; d++) colWidths.push({ width: 4 });
  ws.columns = colWidths;

  const cp = Number(form.coef_pase)   || 1.6504;
  const co = Number(form.coef_oferta) || 1.38;

  let R = 0;
  const row  = (h) => { R++; ws.getRow(R).height = h; return R; };
  const cell = (col) => typeof col==='number' ? ws.getCell(col, R) : ws.getCell(`${col}${R}`);

  function colLetter(i) {
    if (i < 26) return String.fromCharCode(65 + i);
    return String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26));
  }
  const dayCol = (d) => colLetter(3 + d); // d=1 → E, etc.
  const lastCol = dayCol(DIAS);

  // ── Fila 1: Logo navy ────────────────────────────────────────────────────
  row(50); ws.mergeCells(`A${R}:${lastCol}${R}`);
  ws.getCell(`A${R}`).fill = fill(C_NAVY);
  if (logoBuffer) {
    const imgId = wb.addImage({ buffer: logoBuffer, extension: 'jpeg' });
    ws.addImage(imgId, { tl: { col: 0, row: 0 }, br: { col: 4, row: 1 }, editAs: 'oneCell' });
  }

  // ── Fila 2: Título ───────────────────────────────────────────────────────
  row(22); ws.mergeCells(`A${R}:${lastCol}${R}`);
  cell('A').value='PLAN DE TRABAJOS'; cell('A').fill=fill(C_NAVY);
  cell('A').font=fnt(true,C_WHITE,14); cell('A').alignment=aln('center');

  // ── Metadatos mismos que PCP ─────────────────────────────────────────────
  const metaRows = [
    [['COMITENTE', true], [form.cliente_nombre||'GCBA', false]],
    [['LICITACIÓN', true], [form.licitacion||'', false]],
    [['', false], ['', false]],
    [['EMPRESA:', true], ['MEJORES HOSPITALES S.A.', false]],
    [['OBRA:', true], [form.titulo||'', false]],
    [['ESCUELA:', true], [form.proyecto_nombre||'', false]],
    [['DIRECCIÓN:', true], [form.direccion_obra||'', false]],
    [['Nº PRESUP:', true], [form.codigo||'', false]],
    [['PLAZO:', true], [form.plazo?`${form.plazo} días`:'', false]],
    [['Preciario:', true], [fmtDate(form.preciario_fecha)||'', false]],
  ];

  for (const [[lbl, lbold], [val, vbold]] of metaRows) {
    row(13);
    ws.mergeCells(`A${R}:D${R}`);
    cell('A').value=lbl; cell('A').font=fnt(lbold,lbold?C_NAVY2:C_DARK,9); cell('A').alignment=aln('left');
    ws.mergeCells(`E${R}:${lastCol}${R}`);
    cell('E').value=val; cell('E').font=fnt(vbold,C_DARK,9); cell('E').alignment=aln('left');
  }

  // ── Separador ────────────────────────────────────────────────────────────
  row(5); ws.mergeCells(`A${R}:${lastCol}${R}`); cell('A').fill=fill(C_WHITE);

  // ── Header PLAN DE TRABAJOS ───────────────────────────────────────────────
  row(18); ws.mergeCells(`A${R}:${lastCol}${R}`);
  cell('A').value='PLAN DE TRABAJOS'; cell('A').fill=fill(C_NAVY);
  cell('A').font=fnt(true,C_WHITE,11); cell('A').alignment=aln('center');

  // ── Fila de días ──────────────────────────────────────────────────────────
  row(18); ws.mergeCells(`A${R}:D${R}`);
  cell('A').value='DÍAS'; cell('A').fill=fill(C_BLUE_H);
  cell('A').font=fnt(true,C_WHITE,9); cell('A').alignment=aln('center'); cell('A').border=bdr(C_WHITE);
  for (let d=1; d<=DIAS; d++) {
    const cl = ws.getCell(`${dayCol(d)}${R}`);
    cl.value=d; cl.fill=fill('BDD7EE'); cl.font=fnt(true,C_BLUE_H,8);
    cl.alignment=aln('center'); cl.border=bdr(C_BLUE_H);
  }

  // ── Ítems ─────────────────────────────────────────────────────────────────
  for (const rubro of (form.rubros||[])) {
    row(14); ws.mergeCells(`A${R}:${lastCol}${R}`);
    const rb = ws.getCell(`A${R}`);
    rb.value=`  ${(rubro.nombre||'').toUpperCase()}`; rb.fill=fill(C_RUBRO_BG);
    rb.font=fnt(true,C_RUBRO_F,9); rb.alignment=aln('left'); rb.border=bdrMed();

    for (const item of (rubro.items||[])) {
      row(13);
      ws.mergeCells(`A${R}:D${R}`);
      const dc = ws.getCell(`A${R}`);
      dc.value=item.descripcion||''; dc.fill=fill(C_WHITE);
      dc.font=fnt(false,C_DARK,8); dc.alignment=aln('left','middle',true); dc.border=bdr();
      for (let d=1; d<=DIAS; d++) {
        const isWeekend = d%7===0 || d%7===6;
        const cl = ws.getCell(`${dayCol(d)}${R}`);
        cl.fill=fill(isWeekend ? C_ALT : C_WHITE); cl.border=bdr('D0D0D0');
      }
    }
  }

  // ── Generales ────────────────────────────────────────────────────────────
  row(14); ws.mergeCells(`A${R}:${lastCol}${R}`);
  const genH = ws.getCell(`A${R}`);
  genH.value='GENERALES - VOLQUETES - ANDAMIOS - LIMPIEZA DE OBRA';
  genH.fill=fill(C_UBIC); genH.font=fnt(true,C_WHITE,9);
  genH.alignment=aln('left'); genH.border=bdrMed();

  const genItems = ['Andamios','Armado Andamios','Volquetes','Acarreo de materiales','Limpieza de Obra','Tramitaciones'];
  for (let gi=0; gi<genItems.length; gi++) {
    row(13);
    ws.mergeCells(`A${R}:D${R}`);
    const gc = ws.getCell(`A${R}`);
    gc.value=genItems[gi]; gc.fill=fill(gi%2===0?C_GRAY_L:C_WHITE);
    gc.font=fnt(false,C_DARK,8); gc.alignment=aln('left'); gc.border=bdr();
    for (let d=1; d<=DIAS; d++) {
      const cl = ws.getCell(`${dayCol(d)}${R}`);
      cl.fill=fill(d%7===0||d%7===6?C_ALT:C_WHITE); cl.border=bdr('D0D0D0');
    }
  }

  ws.views = [{ state: 'frozen', ySplit: 14, xSplit: 4 }];
}

// ─────────────────────────────────────────────────────────────────────────────
// HOJA ORDEN TAREAS
// ─────────────────────────────────────────────────────────────────────────────
function buildOrdenTareas(wb, rubros) {
  const ws = wb.addWorksheet('ORDEN TAREAS');
  ws.columns = [{ width: 6 }, { width: 50 }];
  let R = 0;

  // Título
  R++; ws.mergeCells(`A${R}:B${R}`);
  ws.getCell(`A${R}`).value = 'ORDEN DE TAREAS';
  ws.getCell(`A${R}`).fill = fill(C_NAVY);
  ws.getCell(`A${R}`).font = fnt(true, C_WHITE, 10);
  ws.getCell(`A${R}`).alignment = aln('center');
  ws.getRow(R).height = 18;

  const items = [
    ...rubros.map((r, i) => [i + 1, (r.nombre || '').toUpperCase()]),
    [null, ''],
    [null, 'VOLQUETES'],
    [null, 'LIMPIEZA DE OBRA'],
    [null, 'TRAMITACIONES'],
  ];

  for (const [num, nombre] of items) {
    R++;
    ws.getRow(R).height = 14;
    if (nombre) {
      const bg = num ? (R % 2 === 0 ? C_ALT : C_WHITE) : C_GRAY_L;
      if (num !== null) {
        ws.getCell(`A${R}`).value = num;
        ws.getCell(`A${R}`).font = fnt(true, C_NAVY, 9);
        ws.getCell(`A${R}`).alignment = aln('center');
        ws.getCell(`A${R}`).fill = fill(bg);
        ws.getCell(`A${R}`).border = bdr();
      }
      ws.getCell(`B${R}`).value = nombre;
      ws.getCell(`B${R}`).font = fnt(!!num, C_DARK, 9);
      ws.getCell(`B${R}`).fill = fill(bg);
      ws.getCell(`B${R}`).border = bdr();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER
// ─────────────────────────────────────────────────────────────────────────────
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