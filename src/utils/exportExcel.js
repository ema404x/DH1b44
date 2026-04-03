import * as XLSX from 'xlsx';

const fmt = (n) => Number(n || 0);

/**
 * Exporta un presupuesto en formato Ministerio a Excel
 */
export function exportPresupuestoExcel(form) {
  const wb = XLSX.utils.book_new();

  // ── PORTADA ──────────────────────────────────────────────────────────
  const portada = [
    ['MEJORES - Sistema de Gestión'],
    ['PRESUPUESTO DE OBRA - FORMATO MINISTERIAL'],
    [],
    ['Código:', form.codigo || ''],
    ['Título:', form.titulo || ''],
    ['Cliente:', form.cliente_nombre || ''],
    ['Proyecto:', form.proyecto_nombre || ''],
    ['Dirección:', form.direccion_obra || ''],
    ['Responsable:', form.responsable || ''],
    ['Fecha Emisión:', form.fecha_emision || ''],
    ['Válido Hasta:', form.fecha_validez || ''],
    ['Estado:', form.estado?.toUpperCase() || ''],
  ];
  const wsPortada = XLSX.utils.aoa_to_sheet(portada);
  wsPortada['!cols'] = [{ wch: 22 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsPortada, 'Portada');

  // ── PLANILLA MINISTERIO ───────────────────────────────────────────────
  const header = [
    'ÍTEM', 'CÓDIGO', 'DESCRIPCIÓN', 'UNIDAD', 'CANTIDAD', 'PRECIO UNITARIO', 'TOTAL'
  ];

  const rows = [header];
  let itemNum = 1;

  (form.rubros || []).forEach((rubro) => {
    // Fila de rubro (separador)
    rows.push([`── ${rubro.nombre?.toUpperCase() || 'RUBRO'} ──`, '', '', '', '', '', '']);

    (rubro.items || []).forEach((item) => {
      rows.push([
        itemNum++,
        item.codigo || '',
        item.descripcion || '',
        item.unidad || '',
        fmt(item.cantidad),
        fmt(item.precio_unitario),
        fmt(item.total),
      ]);
    });

    // Subtotal del rubro
    const rubroSubtotal = (rubro.items || []).reduce((s, i) => s + fmt(i.total), 0);
    rows.push(['', '', `Subtotal ${rubro.nombre}`, '', '', '', rubroSubtotal]);
    rows.push([]);
  });

  // Resumen financiero
  const subtotal = (form.rubros || []).reduce((acc, r) =>
    acc + (r.items || []).reduce((a, i) => a + fmt(i.total), 0), 0);
  const gg = subtotal * ((form.gastos_generales_pct || 15) / 100);
  const ben = (subtotal + gg) * ((form.beneficio_pct || 10) / 100);
  const baseImponible = subtotal + gg + ben;
  const iva = baseImponible * ((form.iva_pct || 21) / 100);
  const total = baseImponible + iva;

  rows.push([]);
  rows.push(['', '', 'RESUMEN FINANCIERO', '', '', '', '']);
  rows.push(['', '', 'Subtotal de obra', '', '', '', subtotal]);
  rows.push(['', '', `Gastos Generales (${form.gastos_generales_pct || 15}%)`, '', '', '', gg]);
  rows.push(['', '', `Beneficio (${form.beneficio_pct || 10}%)`, '', '', '', ben]);
  rows.push(['', '', 'Base Imponible', '', '', '', baseImponible]);
  rows.push(['', '', `IVA (${form.iva_pct || 21}%)`, '', '', '', iva]);
  rows.push(['', '', 'TOTAL', '', '', '', total]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Anchos de columna
  ws['!cols'] = [
    { wch: 6 },   // ÍTEM
    { wch: 12 },  // CÓDIGO
    { wch: 55 },  // DESCRIPCIÓN
    { wch: 10 },  // UNIDAD
    { wch: 10 },  // CANTIDAD
    { wch: 18 },  // PRECIO UNITARIO
    { wch: 18 },  // TOTAL
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Planilla Ministerio');

  // ── GUARDAR ───────────────────────────────────────────────────────────
  XLSX.writeFile(wb, `${form.codigo || 'presupuesto'}_ministerio.xlsx`);
}