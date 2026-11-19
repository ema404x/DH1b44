// Espejo en servidor de src/components/fichar/geoDistance.js (mismo radio y margen).
import { esOmitida } from './util.ts';

const UMBRAL_M = 350;
const MAX_ACC_M = 1500;

const okCoord = (lat: any, lng: any) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

function distancia(lat: any, lng: any, rLat: any, rLng: any, accuracy: any = null) {
  if (!okCoord(rLat, rLng)) return { status: 'no_coords', text: 'Sin coordenadas del sitio', dist: null };
  if (!okCoord(lat, lng)) return { status: 'no_gps', text: 'Sin GPS', dist: null };
  const toRad = (v: number) => v * Math.PI / 180;
  const a = Math.sin(toRad(lat - rLat) / 2) ** 2 +
    Math.cos(toRad(rLat)) * Math.cos(toRad(lat)) * Math.sin(toRad(lng - rLng) / 2) ** 2;
  const meters = 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
  const acc = Number.isFinite(accuracy) && accuracy > 0 ? Math.min(Math.round(accuracy), MAX_ACC_M) : 0;
  const efectiva = Math.max(0, meters - acc);
  const suf = acc > 0 ? ` (±${Math.round(accuracy)}m)` : '';
  return { status: efectiva > UMBRAL_M ? 'far' : 'ok', text: `${Math.round(meters)}m${suf}`, dist: Math.round(meters) };
}

// Misma regla que AsistenciasPanel: peor caso entre entrada y salida.
export function distanciaFichaje(f: any, coords: Map<string, any>) {
  const loc = coords.get(f.location_qr_id);
  const e = distancia(f.entrada_latitude, f.entrada_longitude, loc?.lat, loc?.lng, f.entrada_accuracy);
  if (!f.salida_timestamp || esOmitida(f)) return e;
  const s = distancia(f.salida_latitude, f.salida_longitude, loc?.lat, loc?.lng, f.salida_accuracy);
  if (e.status === 'far' || s.status === 'far') return (s.dist ?? -1) > (e.dist ?? -1) ? s : e;
  if (e.status !== 'ok') return e;
  if (s.status !== 'ok') return s;
  return (s.dist as number) > (e.dist as number) ? s : e;
}