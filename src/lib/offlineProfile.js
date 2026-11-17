/**
 * offlineProfile — Perfil local del último usuario con "Modo sin conexión"
 * habilitado. Permite que la app abra sin señal reconociendo al usuario.
 *
 * Se guarda en IndexedDB un único perfil (el del dueño de la sesión actual):
 * id, nombre, email, rol, sector, empleado vinculado, permisos y fecha.
 * NUNCA se guardan contraseñas ni tokens.
 *
 * Un marcador en localStorage (id del usuario) se borra de forma síncrona al
 * cerrar sesión: si el borrado de IndexedDB quedara a medias, el perfil sin
 * marcador se ignora y no puede revivir a un usuario que ya salió.
 */
import { clearCacheDB } from '@/lib/persistCache';

const DB_NAME = 'dh1-offline';
const STORE = 'profile';
const KEY = 'current';
const MARKER = 'dh1-offline-profile-user';
const READ_TIMEOUT_MS = 2000;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

function readMarker() {
  try { return localStorage.getItem(MARKER); } catch (_) { return null; }
}

async function readProfile() {
  const db = await openDB();
  return new Promise((resolve) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

/** Perfil guardado o null. Nunca lanza ni queda esperando (tope de 2 s). */
export async function loadOfflineProfile() {
  try {
    const profile = await Promise.race([
      readProfile(),
      new Promise((resolve) => setTimeout(() => resolve(null), READ_TIMEOUT_MS)),
    ]);
    if (!profile?.id || readMarker() !== profile.id) return null;
    return profile;
  } catch (_) {
    return null;
  }
}

export async function saveOfflineProfile(profile) {
  try {
    const db = await openDB();
    db.transaction(STORE, 'readwrite').objectStore(STORE).put(profile, KEY);
    localStorage.setItem(MARKER, profile.id);
  } catch (_) { /* silencioso: sin perfil, la app se comporta como siempre */ }
}

export async function clearOfflineProfile() {
  try { localStorage.removeItem(MARKER); } catch (_) {}
  try {
    const db = await openDB();
    db.transaction(STORE, 'readwrite').objectStore(STORE).delete(KEY);
  } catch (_) {}
}

/** true si hay un perfil offline guardado para ese usuario (chequeo síncrono). */
export function hasOfflineProfileFor(userId) {
  return !!userId && readMarker() === userId;
}

/** Borra el perfil offline y la caché local de ese usuario (cierre de sesión). */
export async function clearOfflineSession(userId) {
  await clearOfflineProfile();
  try { if (userId) localStorage.removeItem(`mis-ots-cache-${userId}`); } catch (_) {}
  await clearCacheDB();
}