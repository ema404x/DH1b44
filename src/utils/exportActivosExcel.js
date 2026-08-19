import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

const HEADERS = [
  'Sede', 'Código', 'Nombre', 'Tipo', 'Marca', 'Modelo', 'N° Serie',
  'Área', 'Jefe de Sitio', 'Estado', 'Criticidad', 'Ubicación Detallada',
  'Costo Adquisición', 'Fecha Compra', 'Garantía hasta',
  'Último Mant.', 'Próx. Mant.', 'Frecuencia (días)', 'Notas',
];

export function downloadPlantillaActivos() {
  const ws = XLSX.utils.aoa_to_sheet([HEADERS]);
  ws['!cols'] = [22, 14, 28, 16, 14, 14, 18, 14, 22, 16, 12, 24, 16, 14, 14, 14, 14, 16, 30].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Activos');
  XLSX.writeFile(wb, 'Plantilla_Activos.xlsx');
}

export function exportActivosToExcel(assets, sedes = []) {
  const sedeName = (id) => sedes.find(s => s.id === id)?.nombre || '';
  const rows = assets.map(a => [
    sedeName(a.location_id) || a.sede || '',
    a.code || '', a.name || '', a.type || '', a.brand || '', a.model || '', a.serial_number || '',
    a.area || '', a.jefe_sitio || '', a.status || '', a.criticality || '', a.location || '',
    a.purchase_cost || 0, a.purchase_date || '', a.warranty_expiry || '',
    a.last_maintenance || '', a.next_maintenance || '', a.maintenance_frequency_days || 90,
    a.notes || '', a.visto_bapro ? 'VISTO' : '',
  ]);
  const ws = XLSX.utils.aoa_to_sheet([HEADERS.concat(['Visto BAPRO']), ...rows]);
  ws['!cols'] = [22, 14, 28, 16, 14, 14, 18, 14, 22, 16, 12, 24, 16, 14, 14, 14, 14, 16, 30, 12].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Activos');
  XLSX.writeFile(wb, `Activos_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportActivosToPDF(assets, sedes = []) {
  const sedeName = (id) => sedes.find(s => s.id === id)?.nombre || '';
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const today = new Date().toLocaleDateString('es-AR');

  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('Inventario de Activos', 14, 14);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Generado: ${today}  ·  Total: ${assets.length} activos`, 14, 20);

  // Tabla manual (jspdf-autotable no instalado).
  const cols = ['Cód.', 'Nombre', 'Tipo', 'Sede', 'Estado', 'Criticidad', 'BAPRO', 'Valor'];
  const colWidths = [22, 50, 24, 40, 28, 22, 18, 30];
  const tableLeft = 14;
  let y = 28;
  const rowH = 7;
  const headerH = 8;

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(tableLeft, y, colWidths.reduce((a, b) => a + b, 0), headerH, 'F');
  doc.setTextColor(255);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  let x = tableLeft + 2;
  cols.forEach((c, i) => {
    doc.text(c, x, y + 5.5);
    x += colWidths[i];
  });
  y += headerH;

  // Filas
  doc.setFont('helvetica', 'normal');
  assets.forEach((a, idx) => {
    if (y > 195) {
      doc.addPage();
      y = 20;
      doc.setFillColor(15, 23, 42);
      doc.rect(tableLeft, y, colWidths.reduce((s, w) => s + w, 0), headerH, 'F');
      doc.setTextColor(255);
      doc.setFont('helvetica', 'bold');
      let hx = tableLeft + 2;
      cols.forEach((c, i) => { doc.text(c, hx, y + 5.5); hx += colWidths[i]; });
      y += headerH;
      doc.setFont('helvetica', 'normal');
    }
    if (idx % 2 === 1) {
      doc.setFillColor(245, 247, 250);
      doc.rect(tableLeft, y, colWidths.reduce((s, w) => s + w, 0), rowH, 'F');
    }
    doc.setTextColor(40);
    const cells = [
      (a.code || '').slice(0, 14),
      (a.name || '').slice(0, 36),
      (a.type || '').replace('equipo_', '').replace('instalacion_', '').slice(0, 14),
      (sedeName(a.location_id) || a.sede || '').slice(0, 24),
      (a.status || '').replace('_', ' ').slice(0, 16),
      (a.criticality || '').slice(0, 10),
      a.visto_bapro ? 'Si' : 'No',
      a.purchase_cost ? `$${Number(a.purchase_cost).toLocaleString('es-AR')}` : '—',
    ];
    let cx = tableLeft + 2;
    cells.forEach((val, i) => {
      const txt = String(val);
      doc.text(txt.length > 34 ? txt.slice(0, 34) + '…' : txt, cx, y + 5);
      cx += colWidths[i];
    });
    y += rowH;
  });

  doc.save(`Activos_${new Date().toISOString().slice(0, 10)}.pdf`);
}