/**
 * useOperarioOfflineActions — Cola de transiciones de OT offline (app autenticada).
 *
 * Delega el replay y la clasificación de errores a src/lib/offlineSync.
 * Cuando el operario no tiene conexión, las acciones se guardan en localStorage
 * y se aplican optimistamente al cache de React Query. Al volver la conexión,
 * se reproducen en orden vía transicionEstadoOT (auth_mode='session').
 *
 * Solo maneja transiciones (no create/update de entidades — eso lo cubre
 * useOfflineQueue). Las fotos del reporte requieren upload online (UploadFile
 * necesita un File blob), así que offline el reporte se guarda sin fotos nuevas;
 * la transición se sincroniza igual y el operario puede adjuntar fotos después.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { loadQueue, saveQueue, replayQueue } from '@/lib/offlineSync';
import { useOfflineEnabled, useOfflineOps } from '@/hooks/useOfflineOps';
import { enqueueTransition, onSyncEvent, requestSync } from '@/lib/offlineSyncEngine';

const QUEUE_KEY = 'operario-pending-transitions';

// Upsert optimista de una OT al cache del operario + snapshot offline.
function upsertOperarioOT(queryClient, cacheKey, ot) {
  queryClient.setQueryData(['workorders-operario'], (old = []) => {
    const others = (old || []).filter((o) => o.id !== ot.id);
    return [...others, ot];
  });
  try {
    const cur = queryClient.getQueryData(['workorders-operario']) || [];
    localStorage.setItem(cacheKey, JSON.stringify({ orders: cur, cachedAt: Date.now() }));
  } catch {}
}

// Con offline_habilitado: cola durable (IndexedDB) y sincronizador único.
// Sin él: la cola de siempre (useLegacyOperario), sin cambios.
export function useOperarioOfflineActions(opts) {
  const enabled = useOfflineEnabled();
  const legacy = useLegacyOperario(opts, !enabled);
  const durable = useDurableOperario(opts, enabled);
  return enabled ? durable : legacy;
}

function useDurableOperario({ queryClient, cacheKey }, active) {
  const { ops, syncing } = useOfflineOps(active);
  const mine = ops.filter((o) => o.kind === 'transition' && o.auth === 'session');
  const pendingOtIds = new Set(mine.map((o) => o.ot_id));

  // extraData.pending_blobs: fotos del reporte tomadas sin conexión ({ blob, name }).
  const queueTransition = useCallback(async (ot, accion, extraData, optimisticOT) => {
    const { pending_blobs, ...extra } = extraData || {};
    const id = await enqueueTransition({ auth: 'session', ot, accion, extra_data: extra, blobs: pending_blobs });
    if (optimisticOT) upsertOperarioOT(queryClient, cacheKey, optimisticOT);
    return id;
  }, [queryClient, cacheKey]);

  useEffect(() => {
    if (!active) return undefined;
    return onSyncEvent((e) => {
      if (e.op?.kind !== 'transition' || e.op.auth !== 'session') return;
      if (e.type === 'success' && e.result) upsertOperarioOT(queryClient, cacheKey, e.result);
      if (e.type === 'attention') queryClient.invalidateQueries({ queryKey: ['workorders-operario'] });
    });
  }, [active, queryClient, cacheKey]);

  const syncPending = useCallback(() => requestSync({ force: true }), []);
  return { pendingCount: mine.length, syncing, pendingOtIds, queueTransition, syncPending };
}

function useLegacyOperario({ queryClient, cacheKey }, active) {
  const [pending, setPending] = useState(() => loadQueue(QUEUE_KEY));
  const [syncing, setSyncing] = useState(false);
  const runningRef = useRef(false);

  const pendingOtIds = new Set(pending.map((p) => p.ot_id));

  const persistAndSet = useCallback((q) => { saveQueue(QUEUE_KEY, q); setPending(q); }, []);

  // Upsert optimista de una OT al cache del operario + snapshot offline.
  const upsertOT = useCallback((ot) => upsertOperarioOT(queryClient, cacheKey, ot), [queryClient, cacheKey]);

  const queueTransition = useCallback((ot, accion, extraData, optimisticOT) => {
    const item = {
      id: `pt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ot_id: ot.id,
      accion,
      extra_data: extraData,
      queuedAt: new Date().toISOString(),
      ot_title: ot.title,
    };
    const q = [...loadQueue(QUEUE_KEY), item];
    persistAndSet(q);
    if (optimisticOT) upsertOT(optimisticOT);
    return item.id;
  }, [persistAndSet, upsertOT]);

  const syncPending = useCallback(async () => {
    if (runningRef.current) return;
    if (!loadQueue(QUEUE_KEY).length) return;
    runningRef.current = true;
    setSyncing(true);

    await replayQueue({
      key: QUEUE_KEY,
      buildPayload: (item, extraData) => ({
        ot_id: item.ot_id,
        accion: item.accion,
        extra_data: extraData,
      }),
      // App autenticada: sin uploadFn. Las fotos se suben online vía UploadFile
      // (necesita File blob, no serializable en cola). Si un item trajiera
      // pending_photos, resolvePendingPhotos las deja intactas y la transición
      // se intenta sin esas fotos (el operario las adjunta después si hace falta).
      uploadFn: undefined,
      onItemSuccess: (_item, ot) => upsertOT(ot),
      onItemConflict: (item, message) => {
        toast.error(`"${item.ot_title}": ${message}`);
      },
      onDone: (synced, conflicts) => {
        if (synced > 0) {
          queryClient.invalidateQueries({ queryKey: ['workorders-operario'] });
          toast.success(`${synced} acción${synced !== 1 ? 'es' : ''} sincronizada${synced !== 1 ? 's' : ''}`);
        }
        if (conflicts > 0) {
          // Recargar el estado real del servidor tras descartar conflictos.
          queryClient.invalidateQueries({ queryKey: ['workorders-operario'] });
          queryClient.invalidateQueries({ queryKey: ['workorders'] });
        }
      },
    });

    setPending(loadQueue(QUEUE_KEY));
    setSyncing(false);
    runningRef.current = false;
  }, [upsertOT, queryClient]);

  useEffect(() => {
    if (!active) return undefined;
    const onOnline = () => syncPending();
    window.addEventListener('online', onOnline);
    if (navigator.onLine && loadQueue(QUEUE_KEY).length) syncPending();
    return () => window.removeEventListener('online', onOnline);
  }, [syncPending, active]);

  return { pendingCount: pending.length, syncing, pendingOtIds, queueTransition, syncPending };
}