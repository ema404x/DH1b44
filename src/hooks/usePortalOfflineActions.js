/**
 * usePortalOfflineActions — Cola de transiciones offline para el portal público.
 *
 * A diferencia de useOperarioOfflineActions (que opera sobre el queryClient de
 * la app autenticada), este hook es standalone: el portal no tiene queryClient
 * ni sesión. La cola vive en localStorage y aplica cambios optimistas sobre
 * el estado React local del portal (lista de OTs).
 *
 * Al reconectar, reproduce las transiciones en orden vía transicionEstadoOT
 * con auth_mode='portal' (clave + operario_sesion). Las fotos se guardan como
 * base64 temporales en la cola hasta el sync (el portal sube vía publicFichar).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { getClave, getNombre } from '@/lib/operarioClave';

const QUEUE_KEY = 'portal-pending-transitions';

const load = () => {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY)) || []; } catch { return []; }
};
const save = (q) => {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch {}
};

export function usePortalOfflineActions({ onOptimisticUpdate }) {
  const [pending, setPending] = useState(load);
  const [syncing, setSyncing] = useState(false);
  const runningRef = useRef(false);

  const pendingOtIds = new Set(pending.map((p) => p.ot_id));

  const persistAndSet = useCallback((q) => { save(q); setPending(q); }, []);

  const queueTransition = useCallback((ot, accion, extraData, optimisticOT) => {
    const item = {
      id: `pt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ot_id: ot.id,
      accion,
      extra_data: extraData,
      queuedAt: new Date().toISOString(),
      ot_title: ot.title,
    };
    const q = [...load(), item];
    persistAndSet(q);
    if (optimisticOT && onOptimisticUpdate) onOptimisticUpdate(optimisticOT);
    return item.id;
  }, [persistAndSet, onOptimisticUpdate]);

  const syncPending = useCallback(async () => {
    if (runningRef.current) return;
    const q = load();
    if (!q.length) return;
    runningRef.current = true;
    setSyncing(true);

    let synced = 0;
    const stillPending = [...q];
    const clave = getClave();
    const operario_sesion = getNombre();

    for (const item of q) {
      try {
        const res = await base44.functions.invoke('transicionEstadoOT', {
          ot_id: item.ot_id,
          accion: item.accion,
          extra_data: item.extra_data || {},
          auth_mode: 'portal',
          operario_password: clave,
          operario_sesion,
        });
        if (res.data?.error) {
          toast.error(`"${item.ot_title}": ${res.data.error}`);
          const idx = stillPending.indexOf(item);
          if (idx >= 0) stillPending.splice(idx, 1);
          continue;
        }
        if (res.data?.ot && onOptimisticUpdate) onOptimisticUpdate(res.data.ot);
        const idx = stillPending.indexOf(item);
        if (idx >= 0) stillPending.splice(idx, 1);
        synced++;
      } catch (e) {
        break;
      }
    }

    persistAndSet(stillPending);
    setSyncing(false);
    runningRef.current = false;

    if (synced > 0) {
      toast.success(`${synced} acción${synced !== 1 ? 'es' : ''} sincronizada${synced !== 1 ? 's' : ''}`);
    }
  }, [persistAndSet, onOptimisticUpdate]);

  useEffect(() => {
    const onOnline = () => syncPending();
    window.addEventListener('online', onOnline);
    if (navigator.onLine && load().length) syncPending();
    return () => window.removeEventListener('online', onOnline);
  }, [syncPending]);

  return { pendingCount: pending.length, syncing, pendingOtIds, queueTransition, syncPending };
}