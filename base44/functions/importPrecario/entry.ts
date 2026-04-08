import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import ExcelJS from 'npm:exceljs@4.4.0';

// Parsea la hoja PREMOD del Excel del Ministerio y carga los ítems en PrecarioMinisterio
// Estructura de la hoja PREMOD:
//   col B = código categoría / código ítem numérico
//   col C = código del preciario (ej: GNPR001) o descripción de sección
//   col D = descripción del ítem
//   col E = unidad
//   col F = cantidad
//   col G = P.U. MAT (precio materiales)
//   col H = P.U. MAT con coef pase
//   col I = P.U. M.O.
//   col J = P.U. M.O. con coef pase
//   col K = TOTAL con coef de pase
//   col L = TOTAL con coef de oferta
//   col M = TOTAL oferta MEJORES

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { file_url, comuna } = await req.json();
    if (!file_url || !comuna) {
      return Response.json({ error: 'file_url y comuna son requeridos' }, { status: 400 });
    }

    // Descargar el archivo Excel
    const res = await fetch(file_url);
    if (!res.ok) {
      return Response.json({ error: `No se pudo descargar el archivo: ${res.status}` }, { status: 400 });
    }
    const arrayBuffer = await res.arrayBuffer();

    // Parsear con ExcelJS
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arrayBuffer);

    // Buscar la hoja PREMOD
    const ws = wb.getWorksheet('PREMOD') || wb.getWorksheet('premod');
    if (!ws) {
      const sheets = wb.worksheets.map(s => s.name).join(', ');
      return Response.json({ error: `No se encontró la hoja PREMOD. Hojas disponibles: ${sheets}` }, { status: 400 });
    }

    // Parsear ítems del preciario
    const items = [];
    let currentCategoria = '';
    let currentSubcategoria = '';
    const coef_pase = 1.6504;
    const coef_oferta = 1.38;

    ws.eachRow((row, rowNumber) => {
      if (rowNumber <= 4) return; // Saltar encabezados

      const getVal = (col) => {
        const cell = row.getCell(col);
        if (!cell || cell.value === null || cell.value === undefined) return null;
        if (typeof cell.value === 'object' && cell.value.result !== undefined) return cell.value.result;
        if (typeof cell.value === 'object' && cell.value.text !== undefined) return cell.value.text;
        return cell.value;
      };

      const colB = getVal(2); // col B
      const colC = getVal(3); // col C (código preciario)
      const colD = getVal(4); // col D (descripción)
      const colE = getVal(5); // col E (unidad)
      const colF = getVal(6); // col F (cantidad)
      const colG = getVal(7); // col G (P.U. MAT)
      const colH = getVal(8); // col H (P.U. MAT con coef)
      const colI = getVal(9); // col I (P.U. MO)
      const colJ = getVal(10); // col J (P.U. MO con coef)
      const colK = getVal(11); // col K (total con coef pase)
      const colL = getVal(12); // col L (total con coef oferta)
      const colM = getVal(13); // col M (total oferta MEJORES)

      // Detectar cabeceras de sección (solo col B o C con texto, sin código numérico en col C)
      const bStr = String(colB || '').trim();
      const cStr = String(colC || '').trim();
      const dStr = String(colD || '').trim();

      // Si col B es una letra (A, B, C...) y col C es una sección → nueva categoría
      if (bStr && /^[A-Z]$/.test(bStr) && !colC && dStr) {
        currentCategoria = dStr;
        currentSubcategoria = '';
        return;
      }

      // Si col B tiene formato "A1", "A2", "B1"... → subcategoría
      if (bStr && /^[A-Z]\d+$/.test(bStr) && !cStr.match(/^[A-Z]{2,}/) && dStr) {
        currentSubcategoria = dStr;
        return;
      }

      // Si no hay código de preciario en col C, saltar
      if (!cStr || !/^[A-Z]{2,}/.test(cStr)) return;

      // Debe tener descripción
      if (!dStr) return;

      // Parsear números
      const toNum = (v) => {
        if (v === null || v === undefined) return 0;
        const n = parseFloat(String(v));
        return isNaN(n) ? 0 : n;
      };

      const puMat = toNum(colG);
      const puMo = toNum(colI);
      const puMatCoefPase = toNum(colH);
      const puMoCoefPase = toNum(colJ);
      const totalCoefPase = toNum(colK);
      const totalCoefOferta = toNum(colM) || toNum(colL);

      items.push({
        codigo: cStr,
        descripcion: dStr,
        unidad: String(colE || 'UN').trim().toUpperCase(),
        categoria: currentCategoria,
        subcategoria: currentSubcategoria,
        comuna,
        pu_mat: puMat,
        pu_mo: puMo,
        pu_mat_coef_pase: puMatCoefPase,
        pu_mo_coef_pase: puMoCoefPase,
        coef_pase,
        coef_oferta,
        total_coef_pase: totalCoefPase,
        total_coef_oferta: totalCoefOferta,
        activo: true,
      });
    });

    if (items.length === 0) {
      return Response.json({ error: 'No se encontraron ítems válidos en la hoja PREMOD' }, { status: 400 });
    }

    // Borrar preciario anterior de esta comuna
    let deleted = 0;
    const existing = await base44.asServiceRole.entities.PrecarioMinisterio.filter({ comuna }, 'codigo', 1000);
    for (const item of existing) {
      await base44.asServiceRole.entities.PrecarioMinisterio.delete(item.id);
      deleted++;
    }

    // Insertar en lotes de 50
    const BATCH = 50;
    let created = 0;
    for (let i = 0; i < items.length; i += BATCH) {
      const batch = items.slice(i, i + BATCH);
      await base44.asServiceRole.entities.PrecarioMinisterio.bulkCreate(batch);
      created += batch.length;
    }

    return Response.json({
      success: true,
      message: `Preciario Comuna ${comuna} importado: ${created} ítems (${deleted} anteriores eliminados)`,
      total: created,
      deleted
    });

  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack?.slice(0, 300) }, { status: 500 });
  }
});