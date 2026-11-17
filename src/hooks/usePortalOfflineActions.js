/**
 * usePortalOfflineActions — Cola de transiciones offline para el portal público.
 *
 * Delega el replay y la clasificación de errores a src/lib/offlineSync.
 * La cola vive en localStorage (versionada) y aplica cambios optimistas sobre
 * el estado React local del portal (lista de OTs). Al reconectar, reproduce
 * las transiciones en orden vía transicionEstadoOT con auth_mode='portal'.
 * Las fotos capturadas offline (base64 en extra_data.pending_photos) se suben
 * primero y se reemplazan por URL antes de la transición.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { getClave, getNombre } from '@/lib/operarioClave';
import { loadQueue, saveQueue, replayQueue, uploadPortalPhoto } from '@/lib/offlineSync';
import { useOfflineEnabled, useOfflineOps } from '@/hooks/useOfflineOps';
import { enqueueTransition, onSyncEvent, requestSync } from '@/lib/offlineSyncEngine';

const QUEUE_KEY = 'portal-pending-transitions';

// Con offline_habilitado en este dispositivo: cola durable (IndexedDB) y
// sincronizador único. Sin él: la cola de siempre (useLegacyPortal), sin cambios.
export function usePortalOfflineActions(opts) {
  const enabled = useOfflineEnabled();
  const legacy = useLegacyPortal(opts, !enabled);
  const durable = useDurablePortal(opts, enabled);
  return enabled ? durable : legacy;
}

function useDurablePortal({ onOptimisticUpdate, onSyncComplete }, active) {
  const { ops, syncing } = useOfflineOps(active);
  const mine = ops.filter((o) => o.kind === 'transition' && o.auth === 'portal');
  const pendingOtIds = new Set(mine.map((o) => o.ot_id));

  const onOptimisticUpdateRef = useRef(onOptimisticUpdate);
  const onSyncCompleteRef = useRef(onSyncComplete);
  useEffect(() => { onOptimisticUpdateRef.current = onOptimisticUpdate; }, [onOptimisticUpdate]);
  useEffect(() => { onSyncCompleteRef.current = onSyncComplete; }, [onSyncComplete]);

  const queueTransition = useCallback(async (ot, accion, extraData, optimisticOT) => {
    const id = await enqueueTransition({ auth: 'portal', ot, accion, extra_data: extraData });
    if (optimisticOT && onOptimisticUpdateRef.current) onOptimisticUpdateRef.current(optimisticOT);
    return id;
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    return onSyncEvent((e) => {
      if (e.op?.kind !== 'transition' || e.op.auth !== 'portal') return;
      if (e.type === 'success' && e.result && onOptimisticUpdateRef.current) onOptimisticUpdateRef.current(e.result);
      if (e.type === 'attention' && onSyncCompleteRef.current) onSyncCompleteRef.current({ synced: 0, conflicts: 1 });
    });
  }, [active]);

  const syncPending = useCallback(() => requestSync({ force: true }), []);
  return { pendingCount: mine.length, syncing, pendingOtIds, queueTransition, syncPending };
}

function useLegacyPortal({ onOptimisticUpdate, onSyncComplete }, active) {
  const [pending, setPending] = useState(() => loadQueue(QUEUE_KEY));
  const [syncing, setSyncing] = useState(false);
  const runningRef = useRef(false);

  // Ref al callback más reciente sin re-crear syncPending en cada render.
  const onOptimisticUpdateRef = useRef(onOptimisticUpdate);
  const onSyncCompleteRef = useRef(onSyncComplete);
  useEffect(() => { onOptimisticUpdateRef.current = onOptimisticUpdate; }, [onOptimisticUpdate]);
  useEffect(() => { onSyncCompleteRef.current = onSyncComplete; }, [onSyncComplete]);

  const pendingOtIds = new Set(pending.map((p) => p.ot_id));

  const persistAndSet = useCallback((q) => { saveQueue(QUEUE_KEY, q); setPending(q); }, []);

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
    if (optimisticOT && onOptimisticUpdateRef.current) onOptimisticUpdateRef.current(optimisticOT);
    return item.id;
  }, [persistAndSet]);

  const syncPending = useCallback(async () => {
    if (runningRef.current) return;
    if (!loadQueue(QUEUE_KEY).length) return;
    runningRef.current = true;
    setSyncing(true);

    const clave = getClave();
    const operario_sesion = getNombre();

    await replayQueue({
      key: QUEUE_KEY,
      buildPayload: (item, extraData) => ({
        ot_id: item.ot_id,
        accion: item.accion,
        extra_data: extraData,
        auth_mode: 'portal',
        operario_password: clave,
        operario_sesion,
      }),
      uploadFn: uploadPortalPhoto,
      onItemSuccess: (_item, ot) => {
        if (onOptimisticUpdateRef.current) onOptimisticUpdateRef.current(ot);
      },
      onItemConflict: (item, message) => {
        toast.error(`"${item.ot_title}": ${message}`);
      },
      onDone: (synced, conflicts) => {
        if (synced > 0) {
          toast.success(`${synced} acción${synced !== 1 ? 'es' : ''} sincronizada${synced !== 1 ? 's' : ''}`);
        }
        if (conflicts > 0 && synced === 0) {
          toast.info(`${conflicts} acción(es) descartada(s) por conflicto con el servidor.`);
        }
        // Si hubo conflictos, la UI optimista del portal quedó inconsistente:
        // avisar al componente para que recargue el estado real del servidor.
        if (conflicts > 0 && onSyncCompleteRef.current) {
          onSyncCompleteRef.current({ synced, conflicts });
        }
      },
    });

    setPending(loadQueue(QUEUE_KEY));
    setSyncing(false);
    runningRef.current = false;
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    const onOnline = () => syncPending();
    window.addEventListener('online', onOnline);
    if (navigator.onLine && loadQueue(QUEUE_KEY).length) syncPending();
    return () => window.removeEventListener('online', onOnline);
  }, [syncPending, active]);

  return { pendingCount: pending.length, syncing, pendingOtIds, queueTransition, syncPending };
}