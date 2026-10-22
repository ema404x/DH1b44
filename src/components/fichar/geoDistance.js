export const DISTANCE_THRESHOLD_M = 350;
export const MAX_ACCURACY_MARGIN_M = 1500;

export function hasCoordinates(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export function getDistanceStatus(lat, lng, refLat, refLng, accuracy = null) {
  if (!hasCoordinates(refLat, refLng)) return { status: 'no_coords', text: 'Sin coordenadas del sitio' };
  if (!hasCoordinates(lat, lng)) return { status: 'no_gps', text: 'Sin GPS' };
  const toRad = value => value * Math.PI / 180;
  const a = Math.sin(toRad(lat - refLat) / 2) ** 2 +
    Math.cos(toRad(refLat)) * Math.cos(toRad(lat)) * Math.sin(toRad(lng - refLng) / 2) ** 2;
  const meters = 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
  const dist = Math.round(meters);
  const acc = Number.isFinite(accuracy) && accuracy > 0 ? Math.min(Math.round(accuracy), MAX_ACCURACY_MARGIN_M) : 0;
  const effectiveMeters = Math.max(0, meters - acc);
  const accSuffix = acc > 0 ? ` (±${Math.round(accuracy)}m)` : '';
  return {
    status: effectiveMeters > DISTANCE_THRESHOLD_M ? 'far' : 'ok',
    text: `${dist}m${accSuffix}`,
    dist,
    effectiveDist: Math.round(effectiveMeters),
    accuracy: Number.isFinite(accuracy) && accuracy > 0 ? Math.round(accuracy) : null,
  };
}