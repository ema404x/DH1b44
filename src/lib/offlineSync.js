/**
 * offlineSync — Lógica compartida de replay de cola offline.
 *
 * Consumido por usePortalOfflineActions (portal público, sin sesión) y
 * useOperarioOfflineActions (app autenticada, con queryClient). Centraliza:
 *  - Persistencia versionada en localStorage.
 *  - Clasificación de errores: conflicto permanente (4xx del backend) se
 *    descarta con toast; error transitorio (red / 5xx) se conserva y reintenta.
 *  - Replay en orden con cascada por ot_id: si una transición falla por
 *    conflicto, las dependientes de la misma OT se descartan sin reintento;
 *    las de otras OTs continúan.
 *  - Subida de fotos pendientes (base64 en cola) antes de reproducir la
 *    transición, reemplazándolas por URLs.
 */
import { base44 } from '@/api/base44Client';

const VERSION = 1;

// ── Persistencia ────────────────────────────────────────────────────────────
export function loadQueue(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key));
    if (Array.isArray(raw)) return raw; // legacy: cola como array plano
    if (raw && Array.isArray(raw.items)) return raw.items; // versionada
  } catch {}
  return [];
}

export function saveQueue(key, items) {
  try {
    localStorage.setItem(key, JSON.stringify({ v: VERSION, items, updatedAt: Date.now() }));
  } catch {}
}

// ── Subida de fotos pendientes ───────────────────────────────────────────────
// Si extra_data lleva pending_photos (base64), las sube primero y reemplaza
// por URLs en extra_data.photos. Si la subida falla, lanza → la transición
// se considera transitoria y se conserva en la cola para reintentar.
export async function resolvePendingPhotos(extraData, uploadFn) {
  if (!extraData || !Array.isArray(extraData.pending_photos) || !extraData.pending_photos.length || !uploadFn) {
    return extraData;
  }
  const uploaded = [];
  for (const p of extraData.pending_photos) {
    const url = await uploadFn(p.base64, p.fileName, p.mimeType);
    uploaded.push(url);
  }
  const existing = Array.isArray(extraData.photos) ? extraData.photos : [];
  const { pending_photos, ...rest } = extraData;
  return { ...rest, photos: [...existing, ...uploaded] };
}

// ── Clasificación de resultado ──────────────────────────────────────────────
// Devuelve { ok: true } | { conflict: true, message } | { transient: true, message }
export function classifyResult(res, err) {
  if (err) {
    const status = err?.response?.status || err?.status || err?.statusCode;
    if (status && status >= 500) {
      return { transient: true, message: err.message || 'Error del servidor' };
    }
    if (status && status >= 400 && status < 500) {
      return { conflict: true, message: err?.response?.data?.error || err.message || 'Conflicto con el servidor' };
    }
    // Sin status (TypeError: Failed to fetch) → transitorio de red.
    return { transient: true, message: err.message || 'Error de red' };
  }
  // El SDK devuelve el body incluso en 4xx: el backend responde { error }.
  if (res?.data?.error) return { conflict: true, message: res.data.error };
  return { ok: true };
}

// ── Replay unificado ─────────────────────────────────────────────────────────
// Opciones:
//  key            — localStorage key de la cola.
//  buildPayload   — (item, extraDataResuelta) => payload para transicionEstadoOT.
//  uploadFn       — (base64, fileName, mimeType) => Promise<url>. Opcional.
//  onItemSuccess  — (item, ot) => void.
//  onItemConflict — (item, message) => void.
//  onDone         — (synced, conflicts) => void.
// Devuelve { synced, conflicts, remaining }.
export async function replayQueue({ key, buildPayload, uploadFn, onItemSuccess, onItemConflict, onDone }) {
  const q = loadQueue(key);
  if (!q.length) return { synced: 0, conflicts: 0, remaining: 0 };

  let synced = 0;
  let conflicts = 0;
  const remaining = [];
  const cascadedOtIds = new Set(); // OTs con conflicto: sus items dependientes se descartan.
  let stopped = false;

  for (let i = 0; i < q.length && !stopped; i++) {
    const item = q[i];

    // Cascada: si esta OT ya tuvo un conflicto, descartar sin reintento.
    if (cascadedOtIds.has(item.ot_id)) {
      conflicts++;
      continue;
    }

    // Resolver fotos pendientes (base64 → URL) antes de la transición.
    let payload;
    try {
      const extraData = await resolvePendingPhotos(item.extra_data || {}, uploadFn);
      // Mutar el item con las URLs ya resueltas: si la transición falla
      // transitoriamente, el reintento no vuelve a subir las fotos.
      item.extra_data = extraData;
      payload = buildPayload(item, extraData);
    } catch {
      // Subida de foto falló (transitorio): conservar este item y el resto, parar.
      remaining.push(...q.slice(i));
      stopped = true;
      break;
    }

    try {
      const res = await base44.functions.invoke('transicionEstadoOT', payload);
      const c = classifyResult(res, null);
      if (c.ok) {
        if (res.data?.ot && onItemSuccess) onItemSuccess(item, res.data.ot);
        synced++;
      } else if (c.conflict) {
        cascadedOtIds.add(item.ot_id);
        if (onItemConflict) onItemConflict(item, c.message);
        conflicts++;
      } else {
        // transitorio: conservar y parar.
        remaining.push(...q.slice(i));
        stopped = true;
        break;
      }
    } catch (err) {
      const c = classifyResult(null, err);
      if (c.conflict) {
        cascadedOtIds.add(item.ot_id);
        if (onItemConflict) onItemConflict(item, c.message);
        conflicts++;
      } else {
        remaining.push(...q.slice(i));
        stopped = true;
        break;
      }
    }
  }

  saveQueue(key, remaining);
  if (onDone) onDone(synced, conflicts);
  return { synced, conflicts, remaining: remaining.length };
}