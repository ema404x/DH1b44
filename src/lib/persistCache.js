/**
 * persistCache — Motor de persistencia de queries en IndexedDB.
 * Permite que la app cargue instantáneamente con datos del último uso,
 * luego sincroniza en segundo plano sin interrumpir al usuario.
 */

const DB_NAME = 'dh1-query-cache';
const DB_VERSION = 2;
const STORE = 'queries';
const MAX_CACHE_AGE_MS = 1000 * 60 * 60 * 4;  // 4 horas máximo
const MAX_ENTRIES = 40;                         // tope de entradas en storage
const MAX_ARRAY_ITEMS = 150;                    // tope de ítems por lista guardada

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
    // Acotar listas grandes antes de persistir para no llenar el storage
    const trimmed = Array.isArray(data) && data.length > MAX_ARRAY_ITEMS
      ? data.slice(0, MAX_ARRAY_ITEMS)
      : data;
    const db = await openCacheDB();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({
      queryKey,
      data: trimmed,
      savedAt: Date.now(),
      count: Array.isArray(trimmed) ? trimmed.length : 1,
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
// Bug fix: usar una sola transacción para ambas operaciones — dos transacciones separadas
// producen condiciones de carrera en IDB ya que la segunda puede correr antes que termine el cursor de la primera.
export async function pruneCacheDB() {
  try {
    const db = await openCacheDB();
    // Leer todos los registros primero (readonly), luego borrar los que corresponda (readwrite)
    const allEntries = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).index('savedAt').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    if (allEntries.length === 0) return;

    const cutoff = Date.now() - MAX_CACHE_AGE_MS;
    // Ordenados por savedAt asc (los más viejos primero)
    const toDelete = new Set();

    // 1) Marcar entradas más viejas que MAX_CACHE_AGE_MS
    for (const e of allEntries) {
      if (e.savedAt < cutoff) toDelete.add(e.queryKey);
    }

    // 2) Si tras eso aún hay exceso, marcar las más viejas restantes
    const remaining = allEntries.filter(e => !toDelete.has(e.queryKey));
    const excess = remaining.length - MAX_ENTRIES;
    if (excess > 0) {
      remaining.slice(0, excess).forEach(e => toDelete.add(e.queryKey));
    }

    if (toDelete.size === 0) return;

    // Borrar en una única transacción readwrite
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const key of toDelete) store.delete(key);
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