// Geocodificación con OpenStreetMap Nominatim respetando su política de uso:
// máximo 1 consulta por segundo, User-Agent propio sin datos personales y
// caché persistente (UbicacionGeocache) para no repetir consultas.
const UA = 'DH1-geocoder/1.0';
const ESPERA_MS = 1100;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Texto de consulta normalizado; agrega la ciudad si la dirección no la trae.
export function armarConsulta(direccion: any) {
  let s = String(direccion || '').replace(/\(.*?\)/g, ' ');
  if (s.includes('/')) s = s.split('/')[0];
  s = s.replace(/\s+/g, ' ').trim();
  if (!s) return '';
  if (!/(buenos aires|caba|c\.a\.b\.a|argentina|provincia)/i.test(s)) s += ', Ciudad Autónoma de Buenos Aires, Argentina';
  return s.toLowerCase();
}

async function consultar(q: string) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ar&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es' }, signal: AbortSignal.timeout(6000) });
  if (!res.ok) return { error: res.status };
  const data = await res.json();
  const r = Array.isArray(data) ? data[0] : null;
  return r ? { lat: parseFloat(r.lat), lng: parseFloat(r.lon), nombre: r.display_name || '' } : { lat: null };
}

// Procesa en serie hasta `max` consultas sin caché (1 por segundo). Ante 429/errores se detiene.
// Corta antes si se acerca al tiempo máximo de la función; lo hecho queda en caché.
const PRESUPUESTO_MS = 22000;
export async function geocodificarLote(sb: any, consultas: string[], max = 15) {
  const inicio = Date.now();
  let procesadas = 0;
  for (const q of consultas.slice(0, max)) {
    if (procesadas > 0 && Date.now() - inicio > PRESUPUESTO_MS) break;
    if (procesadas > 0) await sleep(ESPERA_MS);
    const r: any = await consultar(q);
    if (r.error) return { procesadas, detenido: r.error === 429 ? 'OpenStreetMap pidió esperar. Probá de nuevo en unos minutos.' : `OpenStreetMap respondió ${r.error}.` };
    const encontrado = Number.isFinite(r.lat) && Number.isFinite(r.lng);
    await sb.entities.UbicacionGeocache.create({
      consulta: q, encontrado, consultado_en: new Date().toISOString(),
      ...(encontrado ? { lat: r.lat, lng: r.lng, nombre_resultado: String(r.nombre).slice(0, 300) } : {}),
    });
    procesadas++;
  }
  return { procesadas, detenido: null };
}