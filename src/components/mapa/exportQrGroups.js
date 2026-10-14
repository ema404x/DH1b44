import { exportarQRsUbicacionesPDF } from '@/utils/exportLocationsQR';
import downloadPdfArchive from '@/components/mapa/downloadPdfArchive';

export function getQrJefe(location, jefeByLocId) {
  return location.jefe_sitio?.trim() || jefeByLocId?.get(location.id) || 'Sin jefe asignado';
}

export default async function exportQrGroups(locations, jefeByLocId, mode) {
  const groups = new Map();
  for (const location of locations) {
    const jefe = getQrJefe(location, jefeByLocId);
    if (!groups.has(jefe)) groups.set(jefe, []);
    groups.get(jefe).push(location);
  }
  const files = [];
  for (const [jefe, rows] of [...groups].sort(([a], [b]) => a.localeCompare(b, 'es'))) {
    const file = await exportarQRsUbicacionesPDF(rows, mode, { jefe, download: false });
    files.push({ ...file, name: `${String(files.length + 1).padStart(2, '0')}_${file.name}` });
  }
  await downloadPdfArchive(files, mode === 'fichaje' ? 'QRs_Fichaje_por_Jefe.zip' : 'QRs_Ubicaciones_por_Jefe.zip');
  return files.length;
}