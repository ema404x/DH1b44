import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { otEsVisiblePara } from '@/lib/workOrderVisibility';

/**
 * useWorkOrderRealtime — mantiene el cache ['workorders'] sincronizado en vivo
 * mientras haya conexión. Suscribe a eventos de WorkOrder y aplica cada evento
 * incrementalmente sobre el cache (sin refetch), filtrando por visibilidad del
 * caller (otEsVisiblePara + ctx que entrega getWorkOrdersForUser) para no
 * introducir OTs ajenas al tablero.
 *
 * Offline: no suscribe — el tablero queda en modo lectura con el último
 * snapshot cacheado.
 *
 * El cache ['workorders'] tiene shape { orders, total, role, ctx }. Los eventos
 * mutan sólo `orders` (create/update/delete) preservando el resto.
 */
export function useWorkOrderRealtime(ctx, isOnline) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isOnline || !ctx) return undefined;

    const apply = (event) => {
      const type = event?.type;
      const data = event?.data;
      const id = event?.id || data?.id;
      if (!type || !id) return;

      queryClient.setQueryData(['workorders'], (old) => {
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
    };

    const unsubscribe = base44.entities.WorkOrder.subscribe(apply);
    return unsubscribe;
  }, [queryClient, ctx, isOnline]);
}