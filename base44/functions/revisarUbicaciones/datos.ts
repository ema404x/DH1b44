// Arma la lista de ubicaciones a revisar. Solo lee; nunca cambia coordenadas.
// - Colegios: LocationData.gps_latitude/gps_longitude, dirección = Direccion.direccion.
//   Si el colegio está vinculado a un QR de fichaje, ese LocationQR es parte del mismo ítem.
// - QRs sin colegio vinculado: LocationQR.latitude/longitude, dirección = LocationQR.address.
import { crearMatcherQR } from '../../shared/ubicacionJoin.ts';
import { armarConsulta } from './geocoder.ts';

export const UMBRAL_M = 300;

export const okCoord = (lat: any, lng: any) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

export function distanciaM(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = (v: number) => v * Math.PI / 180;
  const a = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2;
  return Math.round(6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, a))));
}

export const firmaCoords = (targets: any[]) =>
  targets.map((t) => (okCoord(t.lat, t.lng) ? `${t.lat.toFixed(6)},${t.lng.toFixed(6)}` : '-')).join('|');

async function todos(sb: any, entity: string, sort = '-created_date') {
  const out: any[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 40; i++) {
    const res = await sb.entities[entity].filter({}, { sort, limit: 500, ...(cursor ? { cursor } : {}) });
    if (Array.isArray(res)) { out.push(...res); break; }
    out.push(...(res?.items || []));
    if (!res?.has_more || !res?.next_cursor) break;
    cursor = res.next_cursor;
  }
  return out;
}

const qrTarget = (q: any) => ({ entidad: 'LocationQR', id: q.id, nombre: q.name || '', lat: q.latitude, lng: q.longitude });

export async function cargarItems(sb: any) {
  const [lds, dirs, qrs, cache, revs] = await Promise.all([
    todos(sb, 'LocationData'), todos(sb, 'Direccion'), todos(sb, 'LocationQR'),
    todos(sb, 'UbicacionGeocache'), todos(sb, 'RevisionUbicacion'),
  ]);
  const dirMap = new Map(dirs.map((d: any) => [d.id, d]));
  const matchQR = crearMatcherQR(qrs);
  const cacheMap = new Map();
  for (const c of cache) if (!cacheMap.has(c.consulta)) cacheMap.set(c.consulta, c);
  const revMap = new Map();
  for (const r of revs) if (!revMap.has(r.clave)) revMap.set(r.clave, r);

  const base: any[] = [];
  const qrVinculados = new Set();
  for (const ld of lds) {
    const direccion = (ld.direccion_id && (dirMap.get(ld.direccion_id) as any)?.direccion) || '';
    if (!direccion) continue;
    const qr = matchQR(ld, direccion);
    if (qr) qrVinculados.add(qr.id);
    const targets = [{ entidad: 'LocationData', id: ld.id, nombre: ld.establecimiento || '', lat: ld.gps_latitude, lng: ld.gps_longitude }];
    if (qr) targets.push(qrTarget(qr));
    base.push({ clave: `ld:${ld.id}`, tipo: 'colegio', nombre: ld.establecimiento || ld.ubic_tecnica || 'Colegio', direccion, comuna: ld.comuna || '', targets });
  }
  for (const q of qrs) {
    if (qrVinculados.has(q.id) || !String(q.address || '').trim()) continue;
    base.push({ clave: `qr:${q.id}`, tipo: 'fichaje', nombre: q.name || 'Ubicación', direccion: q.address, comuna: '', targets: [qrTarget(q)] });
  }

  const pendientes = new Set<string>();
  const items = base.map((it) => {
    const consulta = armarConsulta(it.direccion);
    const c = cacheMap.get(consulta);
    if (consulta && !c) pendientes.add(consulta);
    const sugerida = c?.encontrado && okCoord(c.lat, c.lng) ? { lat: c.lat, lng: c.lng, nombre: c.nombre_resultado || '' } : null;
    const targets = it.targets.map((t: any) => ({
      ...t,
      tieneCoords: okCoord(t.lat, t.lng),
      distancia: sugerida && okCoord(t.lat, t.lng) ? distanciaM(t.lat, t.lng, sugerida.lat, sugerida.lng) : null,
    }));
    const conCoords = targets.filter((t: any) => t.tieneCoords);
    const dists = targets.map((t: any) => t.distancia).filter((d: any) => d != null);
    const distancia = dists.length ? Math.max(...dists) : null;
    let estado = 'ok';
    if (!conCoords.length) estado = 'sin_coordenadas';
    else if (!c) estado = 'pendiente';
    else if (!sugerida) estado = 'sin_resultado';
    else if ((distancia as number) > UMBRAL_M) estado = 'mal_ubicada';
    const rev = revMap.get(it.clave);
    const revisada = Boolean(rev && rev.firma_coords === firmaCoords(it.targets));
    return {
      ...it, targets, sugerida, estado, distancia,
      actual: conCoords[0] ? { lat: conCoords[0].lat, lng: conCoords[0].lng } : null,
      usaFichaje: targets.some((t: any) => t.entidad === 'LocationQR'),
      revisada,
      revision: revisada ? { resultado: rev.resultado, fecha: rev.fecha || rev.created_date, por: rev.revisado_por || '' } : null,
    };
  });
  return { items, pendientes: [...pendientes] };
}

const PRIORIDAD: Record<string, number> = { sin_coordenadas: 0, mal_ubicada: 1, ok: 2, sin_resultado: 3, pendiente: 4 };

export function ordenar(items: any[]) {
  return items.sort((a, b) =>
    (PRIORIDAD[a.estado] - PRIORIDAD[b.estado]) || ((b.distancia ?? -1) - (a.distancia ?? -1)) || a.nombre.localeCompare(b.nombre, 'es'));
}