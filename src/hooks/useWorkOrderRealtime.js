import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { otEsVisiblePara } from '@/lib/workOrderVisibility';

/**
 * useWorkOrderRealtime — mantiene el cache ['workorders-board'] sincronizado en vivo
 * mientras haya conexión. Suscribe a eventos de WorkOrder y aplica cada evento
 * incrementalmente sobre el cache (sin refetch), filtrando por visibilidad del
 * caller (otEsVisiblePara + ctx que entrega getWorkOrdersForUser) para no
 * introducir OTs ajenas al tablero.
 *
 * Offline: no suscribe — el tablero queda en modo lectura con el último
 * snapshot cacheado.
 *
 * El cache ['workorders-board'] tiene shape { orders, total, role, ctx }. Los
 * eventos mutan sólo `orders` (create/update/delete) preservando el resto.
 *
 * RECONCILIACIÓN (robustez upkeep-level):
 *   El ctx que filtra cada evento es CANÓNICO: proviene de getWorkOrdersForUser
 *   → buildOtVisibilityContext → resolveAndReconcileSector (ficha de Empleado),
 *   no de user.data.sector_id (verificado). Así el filtro por evento es
 *   sector-correcto para ambos sectores (escuela y bapro).
 *   Aun así, la aplicación incremental puede driftar si llega un update para una
 *   OT no presente en cache (payload parcial sin sector_id → no-op silencioso).
 *   Por eso se agrega una reconciliación debounced: ante una ráfaga de eventos
 *   (≥3 en 2s) se invalida ['workorders-board'] contra el backend (fuente única
 *   de verdad) para autoreparar cualquier drift. Respeta staleTime via dedup
 *   de React Query y nunca dispara en offline.
 */
const BURST_THRESHOLD = 3;      // eventos mínimos en la ventana para reconciliar
const BURST_WINDOW_MS = 2000;   // ventana de la ráfaga
const RECONCILE_DEBOUNCE_MS = 800;

export function useWorkOrderRealtime(ctx, isOnline) {
  const queryClient = useQueryClient();
  const burstRef = useRef({ count: 0, firstAt: 0, timer: null });

  useEffect(() => {
    if (!isOnline || !ctx) return undefined;

    const scheduleReconcile = () => {
      const b = burstRef.current;
      const now = Date.now();
      // Reset de la ventana si pasó el plazo desde el primer evento de la ráfaga
      if (now - b.firstAt > BURST_WINDOW_MS) {
        b.count = 0;
        b.firstAt = now;
      }
      b.count += 1;
      if (b.count >= BURST_THRESHOLD) {
        if (b.timer) clearTimeout(b.timer);
        b.timer = setTimeout(() => {
          b.timer = null;
          b.count = 0;
          b.firstAt = 0;
          // Reconciliar contra el backend (regla de oro: fuente única de verdad).
          // React Query dedupe requests concurrentes → no hammer.
          queryClient.invalidateQueries({ queryKey: ['workorders-board'] });
        }, RECONCILE_DEBOUNCE_MS);
      }
    };

    const apply = (event) => {
      const type = event?.type;
      const data = event?.data;
      const id = event?.id || data?.id;
      if (!type || !id) return;

      queryClient.setQueryData(['workorders-board'], (old) => {
        const base =
          old && typeof old === 'object' && Array.isArray(old.orders)
            ? old
            : { orders: Array.isArray(old) ? old : [], total: 0, role: null, ctx };
        const orders = base.orders || [];

        if (type === 'delete') {
          const next = orders.filter((o) => o.id !== id);
          return next.length === orders.length ? base : { ...base, orders: next };
        }

        if (type === 'create') {
          if (!data || !otEsVisiblePara(data, ctx)) return base;
          if (orders.some((o) => o.id === id)) return base;
          return { ...base, orders: [data, ...orders] };
        }

        if (type === 'update') {
          const existing = orders.find((o) => o.id === id);
          const merged = existing ? { ...existing, ...data } : data;
          if (!merged || !otEsVisiblePara(merged, ctx)) {
            // Dejó de ser visible → sacarla del tablero.
            return existing ? { ...base, orders: orders.filter((o) => o.id !== id) } : base;
          }
          if (existing) {
            return { ...base, orders: orders.map((o) => (o.id === id ? merged : o)) };
          }
          return { ...base, orders: [merged, ...orders] };
        }

        return base;
      });

      // Contabilizar para la reconciliación por ráfaga.
      scheduleReconcile();
    };

    const unsubscribe = base44.entities.WorkOrder.subscribe(apply);
    return () => {
      unsubscribe();
      if (burstRef.current.timer) {
        clearTimeout(burstRef.current.timer);
        burstRef.current.timer = null;
      }
      burstRef.current.count = 0;
      burstRef.current.firstAt = 0;
    };
  }, [queryClient, ctx, isOnline]);
}