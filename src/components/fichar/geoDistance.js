export const DISTANCE_THRESHOLD_M = 150;

export function hasCoordinates(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export function getDistanceStatus(lat, lng, refLat, refLng) {
  if (!hasCoordinates(refLat, refLng)) return { status: 'no_coords', text: 'Sin coordenadas del sitio' };
  if (!hasCoordinates(lat, lng)) return { status: 'no_gps', text: 'Sin GPS' };
  const toRad = value => value * Math.PI / 180;
  const a = Math.sin(toRad(lat - refLat) / 2) ** 2 +
    Math.cos(toRad(refLat)) * Math.cos(toRad(lat)) * Math.sin(toRad(lng - refLng) / 2) ** 2;
  const meters = 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
  const dist = Math.round(meters);
  return { status: meters > DISTANCE_THRESHOLD_M ? 'far' : 'ok', text: `${dist}m`, dist };
}