/**
 * offlineSyncEngine — sincronizador único de la cola durable (offlineStore).
 *
 *  - Un solo proceso a la vez: navigator.locks, o candado en localStorage (60 s).
 *  - Orden FIFO respetando dependencias: primero se crea la OT, después sus
 *    fotos y cambios; si algo de una OT queda trabado, lo que sigue de esa OT espera.
 *  - Red / 5xx / 408 / 429 / 401 → se reintenta con espera creciente.
 *  - Otros 4xx → "Requiere atención": no se reintenta solo ni se borra.
 *  - Un ítem solo se borra cuando el servidor confirmó.
 */
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { queryClientInstance } from '@/lib/query-client';
import { getClave, getNombre } from '@/lib/operarioClave';
import { resolvePendingPhotos, uploadPortalPhoto } from '@/lib/offlineSync';
import * as store from '@/lib/offlineStore';

const BACKOFF_MS = [5000, 15000, 60000, 300000];
const LOCK_KEY = 'dh1-offline-sync-lock';
const TAB_ID = Math.random().toString(36).slice(2);

// ── Eventos hacia la interfaz ───────────────────────────────────────────────
const listeners = new Set();
const emit = (e) => listeners.forEach((fn) => fn(e));
export function onSyncEvent(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let syncing = false;
export const isSyncing = () => syncing;
function setSyncing(v) {
  if (syncing === v) return;
  syncing = v;
  emit({ type: 'state', syncing: v });
}

// ── Candado: un solo sincronizador entre todas las pestañas ─────────────────
async function withLock(fn) {
  if (navigator.locks?.request) {
    return navigator.locks.request('dh1-offline-sync', { ifAvailable: true }, (lock) => (lock ? fn() : undefined));
  }
  const read = () => { try { return JSON.parse(localStorage.getItem(LOCK_KEY)); } catch { return null; } };
  const write = () => { try { localStorage.setItem(LOCK_KEY, JSON.stringify({ id: TAB_ID, exp: Date.now() + 60000 })); } catch { /* silencioso */ } };
  const cur = read();
  if (cur && cur.id !== TAB_ID && cur.exp > Date.now()) return undefined;
  write();
  const mine = read();
  if (mine && mine.id !== TAB_ID) return undefined;
  const beat = setInterval(write, 20000);
  try {
    return await fn();
  } finally {
    clearInterval(beat);
    try { if (read()?.id === TAB_ID) localStorage.removeItem(LOCK_KEY); } catch { /* silencioso */ }
  }
}

// ── Errores ─────────────────────────────────────────────────────────────────
function rejected(message) {
  const e = new Error(message);
  e.status = 400;
  return e;
}

function classify(err) {
  const status = err?.response?.status ?? err?.status ?? err?.statusCode;
  const message = err?.response?.data?.error || err?.data?.error || err?.message || 'El servidor rechazó el cambio';
  if (!status) return { retry: true, stop: true, message: 'Sin conexión con el servidor' };
  if (status === 401) return { retry: true, stop: true, auth: true, message: 'Iniciá sesión para enviar los pendientes' };
  if (status >= 500 || status === 408 || status === 429) return { retry: true, message };
  if (status >= 400) return { retry: false, message };
  return { retry: true, message };
}

const firstOf = (res) => (Array.isArray(res) ? res : res?.items || [])[0];

async function uploadBlob(blobId) {
  const rec = await store.getBlob(blobId);
  if (!rec?.blob) throw rejected('No se encontró la foto guardada en el dispositivo');
  const file = rec.blob instanceof File
    ? rec.blob
    : new File([rec.blob], rec.name || 'foto.jpg', { type: rec.blob.type || 'image/jpeg' });
  const res = await base44.integrations.Core.UploadPublicFile({ file });
  if (!res?.file_url) throw new Error('No se recibió la URL de la foto subida');
  return res.file_url;
}

async function invokeChecked(name, payload) {
  const res = await base44.functions.invoke(name, payload);
  if (res?.data?.error) throw rejected(res.data.error);
  return res?.data?.ot;
}

// ── Idempotencia de Iniciar / Finalizar ─────────────────────────────────────
// Antes de enviar se compara con el estado actual de la OT en el servidor.
const OT_GONE = 'La OT fue cancelada/eliminada; el cambio no se aplicó';
const ALREADY_DONE = {
  iniciar: ['en_progreso', 'pendiente_validacion', 'completada'],
  finalizar: ['pendiente_validacion', 'completada'],
};
const normName = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const statusOf = (err) => err?.response?.status ?? err?.status ?? err?.statusCode;

let visibleCache = { at: 0, orders: [] };

// Devuelve la OT actual, o null si no se pudo determinar (en ese caso decide el
// servidor al enviar). Sin red o sin sesión el error sube y el ítem se reintenta.
async function readServerOT(op) {
  try {
    if (op.auth === 'portal') {
      const res = await base44.functions.invoke('publicFichar', { action: 'getWorkOrder', workOrderId: op.ot_id });
      return res?.data?.workOrder || null;
    }
    const direct = firstOf(await base44.entities.WorkOrder.filter({ id: op.ot_id }));
    if (direct) return direct;
    // El operario no siempre puede leer la OT directo: se usa su lista visible.
    if (Date.now() - visibleCache.at > 30000) {
      const res = await base44.functions.invoke('getWorkOrdersForUser', { includeArchived: true });
      visibleCache = { at: Date.now(), orders: res?.data?.orders || [] };
    }
    return visibleCache.orders.find((o) => o.id === op.ot_id) || null;
  } catch (err) {
    const status = statusOf(err);
    if (!status || status === 401) throw err;
    return null;
  }
}

// true si la OT ya está en el estado al que lleva la acción (o uno posterior).
function alreadyApplied(op, ot) {
  if (!ALREADY_DONE[op.accion]?.includes(ot.status)) return false;
  if (op.accion !== 'finalizar') return true;
  // Finalizar lleva el reporte: si la OT la cerró otra persona, no se da por
  // enviado en silencio; decide el servidor y queda a la vista.
  if (op.auth === 'portal') {
    const mine = normName(getNombre());
    return !ot.operario_sesion || !mine || normName(ot.operario_sesion) === mine;
  }
  return !ot.assigned_to || !op.user_id || ot.assigned_to === op.user_id;
}

// ── Qué hace cada tipo de operación ─────────────────────────────────────────
const HANDLERS = {
  // Idempotente: si ya existe una OT con este client_op_id, se toma como enviada.
  async create_ot(op) {
    let ot = firstOf(await base44.entities.WorkOrder.filter({ client_op_id: op.client_op_id }));
    if (!ot) ot = await base44.entities.WorkOrder.create({ ...op.data, client_op_id: op.client_op_id });
    if (!ot?.id) throw new Error('El servidor no devolvió la OT creada');
    await store.completeCreate(op.id, ot.id);
    return ot;
  },

  // Propuesta de OT (SolicitudOT): primero las fotos, después el envío.
  // crearSolicitudOT es idempotente por client_op_id (no duplica si se reenvía).
  async create_solicitud(op) {
    for (const id of op.blob_ids || []) {
      if (op.uploaded?.[id]) continue;
      const url = await uploadBlob(id);
      op.uploaded = { ...(op.uploaded || {}), [id]: url };
      await store.putOp(op);
    }
    const fotos = [...(op.data?.fotos || []), ...(op.blob_ids || []).map((id) => op.uploaded[id])];
    const res = await base44.functions.invoke('crearSolicitudOT', { ...op.data, fotos, client_op_id: op.client_op_id });
    if (res?.data?.error) throw rejected(res.data.error);
    return res?.data?.solicitud;
  },

  async update_ot(op) {
    return base44.entities.WorkOrder.update(op.ot_id, op.data);
  },

  // Primero se sube la foto; recién después se agrega la URL a la OT (sin duplicar).
  async photo(op) {
    let url = op.uploaded_url;
    if (!url) {
      url = await uploadBlob(op.blob_id);
      op.uploaded_url = url;
      await store.putOp(op);
    }
    const ot = firstOf(await base44.entities.WorkOrder.filter({ id: op.ot_id }));
    let patch;
    if (op.target === 'checklist') {
      const list = ot?.checklist || op.base_checklist || [];
      if (list.some((t) => t.id === op.checklist_item_id && t.photo_url === url)) return ot;
      patch = { checklist: list.map((t) => (t.id === op.checklist_item_id ? { ...t, photo_url: url } : t)) };
    } else {
      const photos = ot?.photos || op.base_photos || [];
      if (photos.includes(url)) return ot;
      patch = { photos: [...photos, url] };
    }
    return invokeChecked('actualizarOT', { ot_id: op.ot_id, patch });
  },

  async transition(op) {
    if (ALREADY_DONE[op.accion]) {
      const current = await readServerOT(op);
      if (current?.status === 'cancelada') throw rejected(OT_GONE);
      if (current && alreadyApplied(op, current)) return current; // ya aplicado: no se reenvía
    }
    try {
      return await sendTransition(op);
    } catch (err) {
      if (statusOf(err) === 404) throw rejected(OT_GONE);
      throw err;
    }
  },
};

async function sendTransition(op) {
    let extra = op.extra_data || {};
    if (op.blob_ids?.length) {
      for (const id of op.blob_ids) {
        if (op.uploaded?.[id]) continue;
        const url = await uploadBlob(id);
        op.uploaded = { ...(op.uploaded || {}), [id]: url };
        await store.putOp(op);
      }
      const existing = Array.isArray(extra.photos) ? extra.photos : [];
      const urls = op.blob_ids.map((id) => op.uploaded[id]).filter((u) => !existing.includes(u));
      extra = { ...extra, photos: [...existing, ...urls] };
    }
    if (op.auth !== 'portal') {
      return invokeChecked('transicionEstadoOT', { ot_id: op.ot_id, accion: op.accion, extra_data: extra });
    }
    // Portal sin sesión: fotos en base64 → URL, guardando el avance en la cola.
    extra = await resolvePendingPhotos(extra, uploadPortalPhoto);
    op.extra_data = extra;
    await store.putOp(op);
    return invokeChecked('transicionEstadoOT', {
      ot_id: op.ot_id,
      accion: op.accion,
      extra_data: extra,
      auth_mode: 'portal',
      operario_password: getClave(),
      operario_sesion: getNombre(),
    });
}

// ── Una pasada por la cola ──────────────────────────────────────────────────
let migrated = false;
let paused = false;

async function runOnce(force) {
  if (!migrated) {
    try { await store.migrateLegacyQueues(); migrated = true; } catch (e) { console.warn('[offline] migración pendiente', e); }
  }
  if (paused || navigator.onLine === false) return;

  const ops = await store.getOps();
  if (!ops.length) return;

  const blockedOps = new Set();
  const blockedOts = new Set();
  const block = (op) => { blockedOps.add(op.id); if (op.ot_id) blockedOts.add(op.ot_id); };
  let synced = 0;

  for (const listed of ops) {
    const op = await store.getOp(listed.id); // releer: la creación actualiza a sus dependientes
    if (!op) continue;
    if (op.status === 'attention') { block(op); continue; }
    if (op.depends_on && (blockedOps.has(op.depends_on) || await store.getOp(op.depends_on))) { block(op); continue; }
    if (op.ot_id && blockedOts.has(op.ot_id)) { block(op); continue; }
    if (!force && op.next_at > Date.now()) { block(op); continue; }
    const handler = HANDLERS[op.kind];
    if (!handler) { block(op); continue; }

    setSyncing(true);
    op.status = 'sending';
    await store.putOp(op);
    try {
      const result = await handler(op);
      await store.removeOp(op.id); // confirmado por el servidor
      synced++;
      emit({ type: 'success', op, result });
    } catch (err) {
      const c = classify(err);
      const attempts = (op.attempts || 0) + 1;
      const next = c.retry
        ? { ...op, status: 'pending', attempts, error: c.message, auth_required: !!c.auth && op.auth !== 'portal', next_at: Date.now() + BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)] }
        : { ...op, status: 'attention', attempts, error: c.message, auth_required: false, next_at: 0 };
      await store.putOp(next);
      block(next);
      if (!c.retry) {
        toast.error(`${op.ot_title || 'Cambio pendiente'}: requiere atención. ${c.message}`);
        emit({ type: 'attention', op: next, message: c.message });
      }
      if (c.stop) break;
    }
  }

  if (synced > 0) {
    ['workorders', 'workorders-board', 'workorders-campo', 'workorders-operario', 'workorder-detail']
      .forEach((k) => queryClientInstance.invalidateQueries({ queryKey: [k] }));
    if ((await store.getOps()).length === 0) toast.success('Todo enviado', { duration: 2500 });
  }
  emit({ type: 'end', synced });
}

// ── Pedidos de sincronización ───────────────────────────────────────────────
let running = false;
let again = false;
let againForce = false;
let retryTimer = null;

async function scheduleRetry() {
  clearTimeout(retryTimer);
  if (paused) return;
  const waits = (await store.getOps())
    .filter((o) => o.status === 'pending' && o.next_at > Date.now())
    .map((o) => o.next_at - Date.now());
  if (waits.length) retryTimer = setTimeout(() => requestSync(), Math.max(1000, Math.min(...waits)));
}

export function requestSync({ force = false } = {}) {
  if (running) { again = true; againForce = againForce || force; return; }
  running = true;
  (async () => {
    try {
      await withLock(() => runOnce(force));
    } catch (e) {
      console.warn('[offline] error al sincronizar', e);
    } finally {
      running = false;
      setSyncing(false);
      scheduleRetry().catch(() => {});
      if (again) {
        const f = againForce;
        again = false;
        againForce = false;
        requestSync({ force: f });
      }
    }
  })();
}

// En modo sin conexión no se intenta enviar; al salir se sincroniza enseguida.
export function setSyncPaused(v) {
  const was = paused;
  paused = !!v;
  if (was && !paused) requestSync();
}

let started = false;
export function startOfflineSync() {
  if (started) return;
  started = true;
  window.addEventListener('online', () => requestSync());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') requestSync();
  });
  setInterval(() => { if (store.hasPendingMarker()) requestSync(); }, 60000);
  navigator.serviceWorker?.addEventListener?.('message', (e) => {
    if (e.data?.type === 'dh1-sync') requestSync();
  });
  requestSync();
}

// ── Encolado ────────────────────────────────────────────────────────────────
function afterEnqueue() {
  store.requestPersistOnce();
  try {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready.then((reg) => reg.sync.register('dh1-sync')).catch(() => {});
    }
  } catch { /* sin Background Sync */ }
  requestSync();
}

const blobEntry = (p) => ({ id: store.newOpId(), blob: p.blob, name: p.name });

// Crea la OT y, encadenadas a ella, sus fotos. photos: [{ blob, name }]
export async function enqueueCreateOT(data, photos = []) {
  const id = store.newOpId();
  const entries = [{ op: { id, kind: 'create_ot', client_op_id: id, data, ot_title: data?.title } }];
  for (const p of photos) {
    const b = blobEntry(p);
    entries.push({
      op: { kind: 'photo', target: 'photos', depends_on: id, ot_id: null, ot_title: data?.title, blob_id: b.id },
      blobs: [b],
    });
  }
  await store.addOps(entries);
  afterEnqueue();
  return id;
}

// Propuesta de OT con sus fotos guardadas en el dispositivo. photos: [{ blob, name }]
export async function enqueueCreateSolicitudOT(data, photos = []) {
  const id = store.newOpId();
  const list = (photos || []).map(blobEntry);
  await store.addOps([{
    op: { id, kind: 'create_solicitud', client_op_id: id, data, ot_title: data?.titulo, blob_ids: list.map((b) => b.id) },
    blobs: list,
  }]);
  afterEnqueue();
  return id;
}

export async function enqueueUpdateOT(otId, data) {
  await store.addOps([{ op: { kind: 'update_ot', ot_id: otId, data } }]);
  afterEnqueue();
}

// Foto de una OT existente (target 'photos') o de un ítem del checklist.
export async function enqueuePhoto({ ot_id, ot_title, target = 'photos', checklist_item_id, blob, name, base_photos, base_checklist }) {
  const b = blobEntry({ blob, name });
  await store.addOps([{
    op: { kind: 'photo', target, ot_id, ot_title, checklist_item_id, blob_id: b.id, base_photos, base_checklist },
    blobs: [b],
  }]);
  afterEnqueue();
}

// Iniciar / finalizar. blobs: fotos del reporte tomadas sin conexión.
export async function enqueueTransition({ auth, ot, accion, extra_data, blobs = [] }) {
  const list = (blobs || []).map(blobEntry);
  const [op] = await store.addOps([{
    op: {
      kind: 'transition',
      auth,
      ot_id: ot.id,
      ot_title: ot.title,
      accion,
      extra_data: extra_data || {},
      blob_ids: list.map((b) => b.id),
      ...(auth === 'portal' ? { user_id: null } : {}),
    },
    blobs: list,
  }]);
  afterEnqueue();
  return op.id;
}

// ── Acciones del panel de pendientes ────────────────────────────────────────
export async function retryOp(id) {
  const op = await store.getOp(id);
  if (op) await store.putOp({ ...op, status: 'pending', attempts: 0, next_at: 0, error: null, auth_required: false });
  requestSync({ force: true });
}

// Descarta un ítem y lo que dependía de él (por ejemplo, las fotos de una OT nueva).
export async function discardOp(id) {
  const deps = (await store.getAllOps()).filter((o) => o.depends_on === id).map((o) => o.id);
  await store.removeOps([id, ...deps]);
}