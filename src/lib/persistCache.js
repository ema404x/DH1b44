/**
 * persistCache — Motor de persistencia de queries en IndexedDB.
 * Permite que la app cargue instantáneamente con datos del último uso,
 * luego sincroniza en segundo plano sin interrumpir al usuario.
 */

const DB_NAME = 'dh1-query-cache';
const DB_VERSION = 2;
const STORE = 'queries';
const MAX_CACHE_AGE_MS = 1000 * 60 * 60 * 24; // 24 horas máximo

// ── IndexedDB setup ──────────────────────────────────────────────────────────
let _db = null;

function openCacheDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'queryKey' });
        store.createIndex('savedAt', 'savedAt');
      }
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

// ── Guardar datos de una query ────────────────────────────────────────────────
export async function saveCacheEntry(queryKey, data) {
  if (!data || (Array.isArray(data) && data.length === 0)) return;
  try {
    const db = await openCacheDB();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({
      queryKey,
      data,
      savedAt: Date.now(),
      count: Array.isArray(data) ? data.length : 1,
    });
  } catch (_) { /* fallo silencioso — no afecta operación */ }
}

// ── Leer datos de una query ───────────────────────────────────────────────────
export async function loadCacheEntry(queryKey) {
  try {
    const db = await openCacheDB();
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(queryKey);
    return await new Promise((resolve, reject) => {
      req.onsuccess = () => {
        const entry = req.result;
        if (!entry) return resolve(null);
        // Descartar entradas demasiado viejas
        if (Date.now() - entry.savedAt > MAX_CACHE_AGE_MS) return resolve(null);
        resolve(entry);
      };
      req.onerror = () => resolve(null);
    });
  } catch (_) {
    return null;
  }
}

// ── Eliminar entradas viejas (limpieza) ───────────────────────────────────────
export async function pruneCacheDB() {
  try {
    const db = await openCacheDB();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const index = store.index('savedAt');
    const cutoff = Date.now() - MAX_CACHE_AGE_MS;
    const range = IDBKeyRange.upperBound(cutoff);
    const req = index.openCursor(range);
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) { cursor.delete(); cursor.continue(); }
    };
  } catch (_) { /* silencioso */ }
}

// ── Leer TODAS las entradas (para hydration inicial) ─────────────────────────
export async function loadAllCacheEntries() {
  try {
    const db = await openCacheDB();
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    return await new Promise((resolve, reject) => {
      req.onsuccess = () => {
        const now = Date.now();
        resolve((req.result || []).filter(e => now - e.savedAt < MAX_CACHE_AGE_MS));
      };
      req.onerror = () => resolve([]);
    });
  } catch (_) {
    return [];
  }
}

// ── Claves de queries que se persisten ───────────────────────────────────────
export const PERSISTED_QUERY_KEYS = [
  'workorders',
  'projects',
  'clients',
  'employees',
  'materials',
  'assets',
  'pendientes',
  'invoices',
  'calefaccion',
  'rolePermissions',
  'certificados',
  'obras_certificacion',
  'informes',
];