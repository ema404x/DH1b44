/**
 * persistCache — Motor de persistencia de queries en IndexedDB.
 * Permite que la app cargue instantáneamente con datos del último uso,
 * luego sincroniza en segundo plano sin interrumpir al usuario.
 *
 * BLINDAJE v3 (shape-safe):
 *   El bug raíz del TypeError: orders.filter is not a function fue una
 *   COLISIÓN DE SHAPE: varios consumidores registraban queryFns con
 *   shapes distintos sobre el MISMO key[0] ('workorders') → el que montaba
 *   último ganaba la persistencia y envenenaba al resto en la próxima
 *   hidratación. Ahora:
 *     1. Migración v2→v3: onupgradeneeded limpia el objectStore (ephemeral,
 *        regenerable) para purgar las entradas envenenadas existentes.
 *     2. KEY_SHAPES: mapa canónico key → 'array' | 'object'. Cada clave
 *        persistida declara el shape que su queryFn produce.
 *     3. saveCacheEntry valida shape antes de persistir — un dato con shape
 *        distinto al declarado NO se persiste (no puede envenenar futuras
 *        hidrataciones).
 *     4. loadCacheEntry / loadAllCacheEntries + validateShape: al hidratar,
 *        se descartan las entradas cuyo shape no coincide con el declarado.
 *        Claves sin entrada en KEY_SHAPES se hidratan como antes (backward
 *        compat) para no romper módulos no auditados.
 *   Esto elimina la CLASE de bug completa, no sólo el caso reportado.
 */

const DB_NAME = 'dh1-query-cache';
const DB_VERSION = 3;  // v3: wipe poisoned entries (shape collision fix)
const STORE = 'queries';
const MAX_CACHE_AGE_MS = 1000 * 60 * 60 * 4;  // 4 horas máximo
const MAX_ENTRIES = 40;                         // tope de entradas en storage

// ── Shape canónico por clave ─────────────────────────────────────────────────
// Cada clave declarada produce el shape indicado. La validación impide
// persistir/hidratar un dato con shape distinto al declarado (defense-in-depth
// contra futuras colisiones). Claves no listadas → sin validación (backward
// compat: se hidratan como hoy, sin romper módulos no auditados).
export const KEY_SHAPES = {
  'workorders': 'array',
  'workorders-board': 'object',
  'projects': 'array',
  'clients': 'array',
  'employees': 'array',
  'materials': 'array',
  'assets': 'array',
  'pendientes': 'array',
  'invoices': 'array',
  'calefaccion': 'array',
  'rolePermissions': 'array',
  'certificados': 'array',
  'obras_certificacion': 'array',
  'informes': 'array',
  'dashboard-metrics': 'object',
  'direcciones-jefes': 'array',
  'employees-filter-lookup': 'array',
};

/** Valida que `data` tenga el shape declarado para `key`. Sin declaración → true. */
export function validateShape(key, data) {
  const shape = KEY_SHAPES[key];
  if (!shape) return true;  // backward compat
  if (shape === 'array') return Array.isArray(data);
  if (shape === 'object') return !!data && typeof data === 'object' && !Array.isArray(data);
  return true;
}

// ── IndexedDB setup ──────────────────────────────────────────────────────────
let _db = null;

function openCacheDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      const oldVersion = e.oldVersion;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'queryKey' });
        store.createIndex('savedAt', 'savedAt');
      }
      // v2 → v3: purgar entradas envenenadas (objeto {orders,...} persistido
      // bajo claves array, etc.). El cache es efímero y regenerable — limpiar
      // no rompe nada; la app repuebla limpio en el próximo fetch. Sólo se
      // ejecuta al subir de versión (no en installs nuevos).
      if (oldVersion < 3 && db.objectStoreNames.contains(STORE)) {
        try { e.target.transaction.objectStore(STORE).clear(); } catch (_) { /* silencioso */ }
      }
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

// ── Guardar datos de una query ────────────────────────────────────────────────
export async function saveCacheEntry(queryKey, data) {
  if (!data) return;
  if (Array.isArray(data) && data.length === 0) return;
  // Shape-safe: si el dato no coincide con el shape declarado para la clave,
  // no se persiste. Evita envenenar futuras hidrataciones con un shape ajeno
  // (raíz del bug de colisión). Claves sin shape declarado → se persiste igual.
  if (!validateShape(queryKey, data)) return;
  try {
    const db = await openCacheDB();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({
      queryKey,
      data,
      shape: KEY_SHAPES[queryKey] || null,
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
        // Shape-safe: descartar si el shape no coincide con el declarado
        if (!validateShape(queryKey, entry.data)) return resolve(null);
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
    const allEntries = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).index('savedAt').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    if (allEntries.length === 0) return;

    const cutoff = Date.now() - MAX_CACHE_AGE_MS;
    const toDelete = new Set();

    for (const e of allEntries) {
      if (e.savedAt < cutoff) toDelete.add(e.queryKey);
    }

    const remaining = allEntries.filter(e => !toDelete.has(e.queryKey));
    const excess = remaining.length - MAX_ENTRIES;
    if (excess > 0) {
      remaining.slice(0, excess).forEach(e => toDelete.add(e.queryKey));
    }

    if (toDelete.size === 0) return;

    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const key of toDelete) store.delete(key);
  } catch (_) { /* silencioso */ }
}

// ── Leer TODAS las entradas (para hydration inicial) ─────────────────────────
// Shape-safe: filtra las entradas cuyo shape no coincide con el declarado,
// para no inyectar un dato incorrecto en el QueryClient al arrancar.
export async function loadAllCacheEntries() {
  try {
    const db = await openCacheDB();
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    return await new Promise((resolve, reject) => {
      req.onsuccess = () => {
        const now = Date.now();
        resolve((req.result || []).filter(e =>
          now - e.savedAt < MAX_CACHE_AGE_MS &&
          validateShape(e.queryKey, e.data)
        ));
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
  'workorders-board',
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
  // ── OPTIMIZACIÓN DE CARGA ──
  'dashboard-metrics',
  'direcciones-jefes',
  'employees-filter-lookup',
];