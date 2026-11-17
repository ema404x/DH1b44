/**
 * offlineStore — cola durable de cambios pendientes (IndexedDB "dh1-offline").
 *
 *  ops   → una fila por operación pendiente (crear OT, foto, iniciar, finalizar…)
 *  blobs → fotos comprimidas, vinculadas a su operación por op_id
 *
 * Regla: una operación solo se borra cuando el servidor confirmó (o cuando el
 * usuario la descarta a mano). Toda escritura resuelve recién cuando la
 * transacción de IndexedDB terminó (oncomplete), no antes.
 */
const DB_NAME = 'dh1-offline';
const DB_VERSION = 1;
const OPS = 'ops';
const BLOBS = 'blobs';
const MARKER = 'dh1-offline-has-ops';
const PERSIST_ASKED = 'dh1-offline-persist-asked';
const MIN_FREE_BYTES = 50 * 1024 * 1024;

let dbPromise = null;
function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(OPS)) db.createObjectStore(OPS, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(BLOBS)) {
          db.createObjectStore(BLOBS, { keyPath: 'id' }).createIndex('op_id', 'op_id');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { dbPromise = null; reject(req.error); };
    });
  }
  return dbPromise;
}

// Ejecuta fn dentro de una transacción y resuelve cuando quedó confirmada.
function run(stores, mode, fn) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    let out;
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('No se pudo guardar en el dispositivo'));
    fn(t, (v) => { out = v; });
  }));
}

// ── Avisos de cambio (misma pestaña + otras pestañas) ───────────────────────
const listeners = new Set();
let channel = null;
try {
  channel = new BroadcastChannel('dh1-offline');
  channel.onmessage = () => listeners.forEach((fn) => fn());
} catch { /* sin BroadcastChannel: solo esta pestaña */ }

function changed() {
  listeners.forEach((fn) => fn());
  try { channel?.postMessage('changed'); } catch { /* silencioso */ }
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ── Marca liviana en localStorage: "hay pendientes" (evita abrir IndexedDB) ──
function setMarker(on) {
  try {
    if (on) localStorage.setItem(MARKER, '1');
    else localStorage.removeItem(MARKER);
  } catch { /* silencioso */ }
}
export function hasPendingMarker() {
  try { return localStorage.getItem(MARKER) === '1'; } catch { return false; }
}

// ── Usuario actual: cada operación queda atada a quien la hizo ──────────────
let currentUserId = null;
export function setOfflineUser(id) {
  const next = id || null;
  if (next === currentUserId) return;
  currentUserId = next;
  changed();
}

export function newOpId() {
  try { if (crypto?.randomUUID) return crypto.randomUUID(); } catch { /* fallback */ }
  return `op-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

let lastSeq = 0;
function nextSeq() {
  const n = Date.now() * 1000;
  lastSeq = n > lastSeq ? n : lastSeq + 1;
  return lastSeq;
}

// ── Escritura ───────────────────────────────────────────────────────────────
// entries: [{ op, blobs: [{ id, blob, name }] }] — todo en UNA transacción.
export async function addOps(entries) {
  const records = entries.map(({ op, blobs = [] }) => ({
    op: {
      status: 'pending',
      attempts: 0,
      next_at: 0,
      error: null,
      created_at: new Date().toISOString(),
      user_id: currentUserId,
      ...op,
      id: op.id || newOpId(),
      seq: nextSeq(),
    },
    blobs,
  }));
  await run([OPS, BLOBS], 'readwrite', (t) => {
    for (const r of records) {
      t.objectStore(OPS).put(r.op);
      for (const b of r.blobs) {
        t.objectStore(BLOBS).put({ id: b.id, op_id: r.op.id, blob: b.blob, name: b.name || 'foto.jpg', created_at: Date.now() });
      }
    }
  });
  setMarker(true);
  changed();
  return records.map((r) => r.op);
}

export async function putOp(op) {
  await run([OPS], 'readwrite', (t) => { t.objectStore(OPS).put(op); });
  changed();
}

// ── Lectura ─────────────────────────────────────────────────────────────────
export async function getAllOps() {
  const all = await run([OPS], 'readonly', (t, set) => {
    const r = t.objectStore(OPS).getAll();
    r.onsuccess = () => set(r.result || []);
  });
  return (all || []).sort((a, b) => a.seq - b.seq);
}

// Operaciones del usuario actual (más las del portal sin sesión), en orden FIFO.
export async function getOps() {
  const all = await getAllOps();
  return all.filter((o) => !o.user_id || o.user_id === currentUserId);
}

export function getOp(id) {
  return run([OPS], 'readonly', (t, set) => {
    const r = t.objectStore(OPS).get(id);
    r.onsuccess = () => set(r.result || null);
  });
}

export function getBlob(id) {
  return run([BLOBS], 'readonly', (t, set) => {
    const r = t.objectStore(BLOBS).get(id);
    r.onsuccess = () => set(r.result || null);
  });
}

// ── Borrado (solo tras confirmación del servidor o descarte manual) ─────────
function deleteOpInTx(t, id) {
  t.objectStore(OPS).delete(id);
  const cur = t.objectStore(BLOBS).index('op_id').openCursor(IDBKeyRange.only(id));
  cur.onsuccess = () => {
    const c = cur.result;
    if (c) { c.delete(); c.continue(); }
  };
}

async function refreshMarker() {
  const all = await getAllOps();
  setMarker(all.length > 0);
}

export async function removeOps(ids) {
  await run([OPS, BLOBS], 'readwrite', (t) => { ids.forEach((id) => deleteOpInTx(t, id)); });
  await refreshMarker();
  changed();
}

export const removeOp = (id) => removeOps([id]);

// La OT ya existe en el servidor: en una sola transacción se le pasa el id real
// a las operaciones que dependían de ella y se borra la operación de creación.
export async function completeCreate(opId, otId) {
  await run([OPS, BLOBS], 'readwrite', (t) => {
    const s = t.objectStore(OPS);
    const r = s.getAll();
    r.onsuccess = () => {
      for (const o of r.result || []) {
        if (o.depends_on === opId) s.put({ ...o, ot_id: otId, depends_on: null });
      }
      deleteOpInTx(t, opId);
    };
  });
  await refreshMarker();
  changed();
}

// ── Espacio y persistencia ──────────────────────────────────────────────────
export async function isStorageLow() {
  try {
    if (!navigator.storage?.estimate) return false;
    const { quota, usage } = await navigator.storage.estimate();
    if (!quota) return false;
    return quota - (usage || 0) < MIN_FREE_BYTES;
  } catch {
    return false;
  }
}

export function requestPersistOnce() {
  try {
    if (localStorage.getItem(PERSIST_ASKED)) return;
    localStorage.setItem(PERSIST_ASKED, '1');
    navigator.storage?.persist?.().catch(() => {});
  } catch { /* silencioso */ }
}

// ── Migración de las colas viejas ───────────────────────────────────────────
// Copia a IndexedDB y borra el origen SOLO después de confirmar la escritura.
const LEGACY_LS = [
  { key: 'operario-pending-transitions', auth: 'session' },
  { key: 'portal-pending-transitions', auth: 'portal' },
];

function readLegacyLS(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key));
    if (Array.isArray(raw)) return raw;
    if (raw && Array.isArray(raw.items)) return raw.items;
  } catch { /* vacío o ilegible */ }
  return [];
}

async function confirmWritten(entries) {
  const ids = new Set((await getAllOps()).map((o) => o.id));
  return entries.every((e) => ids.has(e.op.id));
}

// Abre la base vieja de OTs creadas sin conexión solo si ya existía.
function openLegacyDB() {
  return new Promise((resolve) => {
    let fresh = false;
    let req;
    try { req = indexedDB.open('dh1-offline-queue', 1); } catch { resolve(null); return; }
    req.onupgradeneeded = () => { fresh = true; try { req.transaction.abort(); } catch { /* silencioso */ } };
    req.onsuccess = () => {
      const db = req.result;
      if (fresh || !db.objectStoreNames.contains('pending')) { db.close(); resolve(null); } else resolve(db);
    };
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

function legacyTx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction('pending', mode);
    let out;
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
    fn(t.objectStore('pending'), (v) => { out = v; });
  });
}

export async function migrateLegacyQueues() {
  // 1) Colas de localStorage (iniciar / finalizar del operario y del portal).
  for (const { key, auth } of LEGACY_LS) {
    const items = readLegacyLS(key);
    if (!items.length) continue;
    const entries = items.map((it, i) => ({
      op: {
        id: `legacy-${key}-${it.id || i}`,
        kind: 'transition',
        auth,
        ot_id: it.ot_id,
        ot_title: it.ot_title,
        accion: it.accion,
        extra_data: it.extra_data || {},
        created_at: it.queuedAt || new Date().toISOString(),
        user_id: null,
      },
    }));
    await addOps(entries);
    if (await confirmWritten(entries)) localStorage.removeItem(key);
  }

  // 2) Base vieja de IndexedDB (OTs creadas o editadas sin conexión).
  const legacy = await openLegacyDB();
  if (!legacy) return;
  try {
    const items = await legacyTx(legacy, 'readonly', (s, set) => {
      const r = s.getAll();
      r.onsuccess = () => set(r.result || []);
    });
    if (!items?.length) return;
    const entries = items.map((it) => {
      const uid = it.localId || `${it.queuedAt || ''}-${it.id}`;
      const base = { id: `legacy-idb-${uid}`, created_at: it.queuedAt || new Date().toISOString(), user_id: null };
      return it.action === 'update'
        ? { op: { ...base, kind: 'update_ot', ot_id: it.entityId, data: it.data } }
        : { op: { ...base, kind: 'create_ot', client_op_id: uid, data: it.data, ot_title: it.data?.title } };
    });
    await addOps(entries);
    if (await confirmWritten(entries)) {
      await legacyTx(legacy, 'readwrite', (s) => { items.forEach((it) => s.delete(it.id)); });
    }
  } finally {
    legacy.close();
  }
}