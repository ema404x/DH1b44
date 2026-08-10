/**
 * useOperarioOfflineActions — Cola de transiciones de OT offline (iniciar/finalizar).
 *
 * Cuando el operario no tiene conexión, las acciones se guardan en localStorage
 * y se aplican optimistamente al cache de React Query (la OT cambia de sección
 * de inmediato en la UI). Al volver la conexión, se reproducen en orden vía la
 * función backend `transicionEstadoOT`.
 *
 * Solo maneja transiciones (no create/update de entidades — eso lo cubre
 * useOfflineQueue). Las fotos del reporte requieren upload online, así que
 * offline el operario puede finalizar sin fotos (require_photos solo aplica
 * al aprobar/completar, que es del jefe).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const QUEUE_KEY = 'operario-pending-transitions';

const load = () => {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY)) || []; } catch { return []; }
};
const save = (q) => {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch {}
};

export function useOperarioOfflineActions({ queryClient, cacheKey }) {
  const [pending, setPending] = useState(load);
  const [syncing, setSyncing] = useState(false);
  const runningRef = useRef(false);

  const pendingOtIds = new Set(pending.map((p) => p.ot_id));

  const persistAndSet = (q) => { save(q); setPending(q); };

  // Upsert optimista de una OT al cache del operario + snapshot offline.
  const upsertOT = useCallback((ot) => {
    queryClient.setQueryData(['workorders-operario'], (old = []) => {
      const others = (old || []).filter((o) => o.id !== ot.id);
      return [...others, ot];
    });
    try {
      const cur = queryClient.getQueryData(['workorders-operario']) || [];
      localStorage.setItem(cacheKey, JSON.stringify({ orders: cur, cachedAt: Date.now() }));
    } catch {}
  }, [queryClient, cacheKey]);

  // Encolar una transición sin conexión. Aplica el cambio optimista al cache
  // (la OT se mueve de sección de inmediato) y guarda la acción para sincronizar.
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
    if (optimisticOT) upsertOT(optimisticOT);
    return item.id;
  }, [upsertOT]);

  // Reproducir la cola en orden. Éxito → sacar de la cola. Error de red →
  // mantener y parar (se reintenta al próximo 'online'). Rechazo del servidor
  // (estado inválido, etc.) → sacar y notificar (no reintenta infinitamente).
  const syncPending = useCallback(async () => {
    if (runningRef.current) return;
    const q = load();
    if (!q.length) return;
    runningRef.current = true;
    setSyncing(true);

    let synced = 0;
    const stillPending = [...q];

    for (const item of q) {
      try {
        const res = await base44.functions.invoke('transicionEstadoOT', {
          ot_id: item.ot_id,
          accion: item.accion,
          extra_data: item.extra_data || {},
        });
        if (res.data?.error) {
          // Rechazo permanente: notificar y descartar (no reintenta).
          toast.error(`"${item.ot_title}": ${res.data.error}`);
          const idx = stillPending.indexOf(item);
          if (idx >= 0) stillPending.splice(idx, 1);
          continue;
        }
        if (res.data?.ot) upsertOT(res.data.ot);
        const idx = stillPending.indexOf(item);
        if (idx >= 0) stillPending.splice(idx, 1);
        synced++;
      } catch (e) {
        // Error de red: parar y conservar el resto para el próximo intento.
        break;
      }
    }

    persistAndSet(stillPending);
    setSyncing(false);
    runningRef.current = false;

    if (synced > 0) {
      queryClient.invalidateQueries({ queryKey: ['workorders-operario'] });
      toast.success(
        `${synced} acción${synced !== 1 ? 'es' : ''} sincronizada${synced !== 1 ? 's' : ''}`,
      );
    }
  }, [upsertOT, queryClient]);

  // Auto-sincronizar al volver la conexión y al montar si ya hay online + pendientes.
  useEffect(() => {
    const onOnline = () => syncPending();
    window.addEventListener('online', onOnline);
    if (navigator.onLine && load().length) syncPending();
    return () => window.removeEventListener('online', onOnline);
  }, [syncPending]);

  return { pendingCount: pending.length, syncing, pendingOtIds, queueTransition, syncPending };
}