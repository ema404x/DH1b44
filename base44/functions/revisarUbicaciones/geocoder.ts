// Geocodificación con OpenStreetMap Nominatim respetando su política de uso:
// máximo 1 consulta por segundo, User-Agent propio sin datos personales y
// caché persistente (UbicacionGeocache) para no repetir consultas.
const UA = 'DH1-geocoder/1.0';
const ESPERA_MS = 1100;
const TIMEOUT_MS = 12000;
// Preferir CABA sin excluir resultados de afuera (sin bounded).
const VIEWBOX = '-58.55,-34.52,-58.33,-34.74';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Mismas abreviaturas que normaliza geocodificarColegios.
function expandirAbreviaturas(s: string) {
  return s
    .replace(/\bAVDA\.\s*/gi, 'AVENIDA ')
    .replace(/\bAVDA\b/gi, 'AVENIDA')
    .replace(/\bAV\.\s*/gi, 'AVENIDA ')
    .replace(/\bGRAL\.\s*/gi, 'GENERAL ')
    .replace(/\bDR\.\s*/gi, 'DOCTOR ')
    .replace(/\bTTE\s+/gi, 'TENIENTE ')
    .replace(/\bCNEL\.\s*/gi, 'CORONEL ')
    .replace(/\bPJE\.\s*/gi, 'PASAJE ')
    .replace(/\bB°\s*/gi, 'BARRIO ');
}

// Texto de consulta normalizado; agrega la ciudad si la dirección no la trae.
export function armarConsulta(direccion: any) {
  let s = String(direccion || '').replace(/\(.*?\)/g, ' ');
  if (s.includes('/')) s = s.split('/')[0];
  s = expandirAbreviaturas(s).replace(/\s+/g, ' ').trim();
  if (!s) return '';
  if (!/(buenos aires|caba|c\.a\.b\.a|argentina|provincia)/i.test(s)) s += ', Ciudad Autónoma de Buenos Aires, Argentina';
  return s.toLowerCase();
}

// Nunca lanza: devuelve { error: 'timeout' | 'red' | <status http> } o el resultado.
async function consultar(q: string) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ar&viewbox=${VIEWBOX}&q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return { error: res.status };
    const data = await res.json();
    const r = Array.isArray(data) ? data[0] : null;
    return r ? { lat: parseFloat(r.lat), lng: parseFloat(r.lon), nombre: r.display_name || '' } : { lat: null };
  } catch (e: any) {
    return { error: e?.name === 'TimeoutError' || e?.name === 'AbortError' ? 'timeout' : 'red' };
  }
}

// Procesa en serie hasta `max` consultas sin caché (1 por segundo).
// Timeout o error de red: no se guarda en caché (se reintenta después) y se sigue.
// Se detiene ante 429/403 o 3 fallos seguidos. Corta antes del tiempo máximo; lo hecho queda en caché.
const PRESUPUESTO_MS = 40000;
export async function geocodificarLote(sb: any, consultas: string[], max = 10) {
  const inicio = Date.now();
  let procesadas = 0;
  let fallidas = 0;
  let seguidas = 0;
  let intentos = 0;
  for (const q of consultas.slice(0, max)) {
    if (intentos > 0 && Date.now() - inicio > PRESUPUESTO_MS) break;
    if (intentos > 0) await sleep(ESPERA_MS);
    intentos++;
    const r: any = await consultar(q);
    if (r.error === 429) return { procesadas, fallidas, detenido: 'OpenStreetMap pidió esperar. Probá de nuevo en unos minutos.' };
    if (r.error === 403) return { procesadas, fallidas, detenido: 'OpenStreetMap rechazó las consultas por ahora. Probá de nuevo más tarde.' };
    if (r.error) {
      fallidas++;
      seguidas++;
      if (seguidas >= 3) {
        return { procesadas, fallidas, detenido: 'OpenStreetMap no responde (3 consultas seguidas sin respuesta). Lo buscado quedó guardado: podés seguir más tarde.' };
      }
      continue;
    }
    seguidas = 0;
    const encontrado = Number.isFinite(r.lat) && Number.isFinite(r.lng);
    await sb.entities.UbicacionGeocache.create({
      consulta: q, encontrado, consultado_en: new Date().toISOString(),
      ...(encontrado ? { lat: r.lat, lng: r.lng, nombre_resultado: String(r.nombre).slice(0, 300) } : {}),
    });
    procesadas++;
  }
  return { procesadas, fallidas, detenido: null };
}