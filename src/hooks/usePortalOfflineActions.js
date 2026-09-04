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
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { getClave, getNombre } from '@/lib/operarioClave';
import { loadQueue, saveQueue, replayQueue } from '@/lib/offlineSync';

const QUEUE_KEY = 'portal-pending-transitions';

// Subida de fotos del portal vía publicFichar (backend público sin sesión).
const uploadPortalPhoto = async (base64, fileName, mimeType) => {
  const res = await base44.functions.invoke('publicFichar', {
    action: 'uploadFile',
    fileBase64: base64,
    fileName,
    mimeType,
  });
  if (!res.data?.file_url) throw new Error('upload_sin_url');
  return res.data.file_url;
};

export function usePortalOfflineActions({ onOptimisticUpdate, onSyncComplete }) {
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
    const onOnline = () => syncPending();
    window.addEventListener('online', onOnline);
    if (navigator.onLine && loadQueue(QUEUE_KEY).length) syncPending();
    return () => window.removeEventListener('online', onOnline);
  }, [syncPending]);

  return { pendingCount: pending.length, syncing, pendingOtIds, queueTransition, syncPending };
}