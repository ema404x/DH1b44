// Relación LocationData (colegio) ↔ LocationQR (punto de fichaje/QR).
// Misma regla que usa obtenerUbicaciones: nombre del establecimiento,
// luego dirección, luego ubicación técnica. Se comparte para que la
// revisión de ubicaciones corrija el mismo QR que muestra el resto de la app.
const norm = (s: any) => String(s || '').toLowerCase().trim();

export function crearMatcherQR(locationQRs: any[]) {
  const qrByName = new Map();
  const qrByAddress = new Map();
  for (const q of locationQRs) {
    if (q.name) qrByName.set(norm(q.name), q);
    if (q.address) qrByAddress.set(norm(q.address), q);
  }
  return (ld: any, address: string) =>
    qrByName.get(norm(ld.establecimiento)) ||
    qrByAddress.get(norm(address)) ||
    qrByName.get(norm(ld.ubic_tecnica)) ||
    null;
}