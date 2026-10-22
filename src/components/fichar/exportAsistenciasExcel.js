import * as XLSX from 'xlsx';
import { base44 } from '@/api/base44Client';
import { getDistanceStatus } from '@/components/fichar/geoDistance';

const ADMIN = { pendiente: 'Pendiente', revisado: 'Revisado', incidencia: 'Incidencia' };
const clock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit',
  day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
function excelDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = Object.fromEntries(clock.formatToParts(date).map(p => [p.type, p.value]));
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) / 86400000 + 25569;
}
function isSalidaOmitida(item) {
  return Boolean(item?.salida_omitida || item?.estado === 'salida_omitida');
}
function distance(item, coordinates) {
  const loc = coordinates.get(item.location_qr_id);
  const entry = getDistanceStatus(item.entrada_latitude, item.entrada_longitude, loc?.lat, loc?.lng, item.entrada_accuracy);
  if (!item.salida_timestamp || isSalidaOmitida(item)) return entry;
  const exit = getDistanceStatus(item.salida_latitude, item.salida_longitude, loc?.lat, loc?.lng, item.salida_accuracy);
  if (entry.status === 'far' || exit.status === 'far') return (exit.dist ?? -1) > (entry.dist ?? -1) ? exit : entry;
  if (entry.status !== 'ok') return entry;
  if (exit.status !== 'ok') return exit;
  return exit.dist > entry.dist ? exit : entry;
}
function sheet(rows, widths, formats = {}) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = widths.map(wch => ({ wch }));
  ws['!rows'] = [{ hpt: 26 }, ...rows.slice(1).map(() => ({ hpt: 22 }))];
  ws['!autofilter'] = { ref: ws['!ref'] };
  for (let r = 1; r < rows.length; r++) {
    for (const [column, z] of Object.entries(formats)) {
      const cell = ws[XLSX.utils.encode_cell({ r, c: +column })];
      if (cell?.t === 'n') cell.z = z;
    }
  }
  return ws;
}

export default async function exportAsistenciasExcel(query, coordinates) {
  // El archivo incluye todas las páginas que coinciden con los filtros, no solo las 200 visibles.
  const records = [];
  let cursor;
  do {
    const page = await base44.entities.FichajeUbicacion.filter(query, { sort: '-entrada_timestamp', limit: 500, cursor });
    records.push(...page.items);
    cursor = page.has_more ? page.next_cursor : undefined;
  } while (cursor);
  if (!records.length) return 0;
  const grouped = await base44.entities.FichajeUbicacion.aggregate({
    query, groupBy: ['dni', 'operario_nombre'], limit: 1000,
  });
  if (grouped.truncated) throw new Error('El resumen supera los 1000 operarios. Acotá los filtros para descargarlo completo.');
  const detail = [['Operario', 'DNI', 'Ubicación', 'Entrada', 'Salida', 'Horas trabajadas', 'Distancia', 'Jornada', 'Estado administrativo', 'Notas']];
  // Duraciones y cachés de fórmulas se calculan únicamente para el archivo exportado.
  const totals = new Map();
  for (const i of records) {
    const key = JSON.stringify([i.dni || '', i.operario_nombre || '']);
    const total = totals.get(key) || { days: 0, open: 0, closed: 0, omitted: 0, incidents: 0 };
    const omitted = isSalidaOmitida(i);
    const elapsed = !omitted && i.entrada_timestamp && i.salida_timestamp
      ? (new Date(i.salida_timestamp) - new Date(i.entrada_timestamp)) / 86400000 : null;
    const duration = elapsed !== null && Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : null;
    total.days += duration ?? 0;
    total.open += i.estado === 'abierta' ? 1 : 0;
    total.closed += (i.estado === 'cerrada' && !omitted) ? 1 : 0;
    total.omitted += omitted ? 1 : 0;
    total.incidents += (i.estado_admin === 'incidencia' || omitted) ? 1 : 0;
    totals.set(key, total);
    const jornadaLabel = omitted ? 'Salida omitida' : (i.estado === 'abierta' ? 'Abierta' : 'Cerrada');
    detail.push([i.operario_nombre || '', String(i.dni || ''), i.location_name || '',
      excelDate(i.entrada_timestamp), excelDate(i.salida_timestamp), duration ?? '',
      distance(i, coordinates).text, jornadaLabel,
      ADMIN[i.estado_admin] || (omitted ? 'Incidencia' : 'Pendiente'), i.notas_admin || '']);
  }
  const summary = [['Operario', 'DNI', 'Total fichajes', 'Jornadas abiertas', 'Jornadas cerradas', 'Salidas omitidas', 'Horas trabajadas', 'Incidencias']];
  const groups = [...grouped.rows].sort((a, b) => (a.operario_nombre || '').localeCompare(b.operario_nombre || '', 'es'));
  for (const group of groups) {
    const name = group.operario_nombre || '';
    const dni = String(group.dni || '');
    const total = totals.get(JSON.stringify([dni, name])) || { days: 0, open: 0, closed: 0, omitted: 0, incidents: 0 };
    const row = summary.length + 1;
    const end = detail.length;
    const criteria = `'Detalle'!$A$2:$A$${end},A${row},'Detalle'!$B$2:$B$${end},B${row}`;
    summary.push([name, dni, group.count,
      { t: 'n', f: `COUNTIFS(${criteria},'Detalle'!$H$2:$H$${end},"Abierta")`, v: total.open },
      { t: 'n', f: `COUNTIFS(${criteria},'Detalle'!$H$2:$H$${end},"Cerrada")`, v: total.closed },
      { t: 'n', f: `COUNTIFS(${criteria},'Detalle'!$H$2:$H$${end},"Salida omitida")`, v: total.omitted },
      { t: 'n', f: `SUMIFS('Detalle'!$F$2:$F$${end},${criteria})`, v: total.days, z: '[h]:mm' },
      { t: 'n', f: `COUNTIFS(${criteria},'Detalle'!$I$2:$I$${end},"Incidencia")`, v: total.incidents }]);
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet(summary, [32, 15, 18, 21, 21, 21, 21, 16], { 6: '[h]:mm' }), 'Resumen por operario');
  XLSX.utils.book_append_sheet(wb, sheet(detail, [32, 15, 44, 23, 23, 21, 32, 15, 24, 60],
    { 3: 'dd/mm/yyyy hh:mm', 4: 'dd/mm/yyyy hh:mm', 5: '[h]:mm' }), 'Detalle');
  wb.Props = { Title: 'Resumen de asistencias', Subject: 'Horarios de Argentina (UTC-3)', Author: 'DH1' };
  XLSX.writeFile(wb, `asistencias_${new Date().toISOString().slice(0, 10)}.xlsx`, { compression: true });
  return records.length;
}