/**
 * fichajeOffline — habilitación guardada en el teléfono para fichar con la
 * cuenta sin señal (IndexedDB "dh1-offline", almacén meta). Se renueva cada
 * vez que el operario abre la app con conexión y vale 7 días.
 * Con FICHAJE_SIN_CONEXION = false no se guarda ni se lee nada.
 */
import { base44 } from '@/api/base44Client';
import { FICHAJE_SIN_CONEXION } from '@/lib/fichajeCuenta';
import { getMeta, putMeta, deleteMeta } from '@/lib/offlineStore';
import { pageLoaders } from '@/lib/lazyPages';

const KEY = 'fichaje_habilitacion';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const AR_OFFSET_MS = 3 * 60 * 60 * 1000;

let preparadoPara = null;

export async function leerHabilitacion() {
  if (!FICHAJE_SIN_CONEXION) return null;
  try {
    const h = await getMeta(KEY);
    if (!h?.user_id || typeof h.savedAt !== 'number' || Date.now() - h.savedAt >= MAX_AGE_MS) return null;
    return h;
  } catch {
    return null;
  }
}

export function borrarHabilitacion() {
  preparadoPara = null;
  return deleteMeta(KEY).catch(() => {});
}

// Pantallas que tienen que abrir sin red: el Service Worker guarda sus archivos al pedirlas.
function precargarPantallas() {
  [pageLoaders.FichajeSinConexionApp, pageLoaders.FicharCuenta, () => import('@/components/operario/QRScannerModal')]
    .forEach((load) => load().catch(() => {}));
}

/** Con señal: pide al servidor la habilitación y la guarda (una vez por apertura). */
export async function prepararFichajeSinConexion(user) {
  if (!FICHAJE_SIN_CONEXION || !user?.id || preparadoPara === user.id) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  preparadoPara = user.id;
  try {
    const { data } = await base44.functions.invoke('ficharConCuenta', { action: 'preparar' });
    if (data?.code === 'no_elegible') { await borrarHabilitacion(); return; }
    if (!data?.ok || data.user_id !== user.id) { preparadoPara = null; return; }
    await putMeta(KEY, {
      user_id: data.user_id,
      user: {
        id: user.id, email: user.email || null, full_name: user.full_name || null, role: user.role || 'user',
        sector_id: data.sector_id, data: { sector_id: data.sector_id },
      },
      operario_nombre: data.operario_nombre,
      employee_role: data.employee_role,
      sector_id: data.sector_id,
      locations: data.locations || [],
      abierta: data.abierta || null,
      savedAt: Date.now(),
    });
    precargarPantallas();
  } catch {
    preparadoPara = null; // sin red o error: se reintenta en la próxima apertura
  }
}

const diaAr = (t) => new Date(new Date(t).getTime() - AR_OFFSET_MS).toISOString().slice(0, 10);

/** Entrada o salida según el último estado guardado (misma regla que el servidor). */
export function decidirTipoLocal(hab, locId, now = new Date()) {
  let ab = hab?.abierta;
  if (ab && diaAr(ab.entrada_timestamp) < diaAr(now)) ab = null;
  if (ab?.location_qr_id === locId) return { tipo: 'salida', otra: null };
  return { tipo: 'entrada', otra: ab ? (ab.location_name || 'otro lugar') : null };
}

/** Actualiza el estado guardado después de guardar un fichaje sin señal. */
export async function registrarFichajeLocal(hab, { tipo, loc, hora }) {
  const abierta = tipo === 'entrada'
    ? { location_qr_id: loc.id, location_name: loc.name, entrada_timestamp: hora }
    : null;
  await putMeta(KEY, { ...hab, abierta });
}