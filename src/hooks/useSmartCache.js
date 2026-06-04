/**
 * useSmartCache — Hidrata el QueryClient con datos del cache local (IndexedDB)
 * antes de que lleguen los datos del servidor, logrando carga instantánea.
 *
 * Estrategia: Stale-While-Revalidate
 *   1. Al montar: carga datos del cache → pantalla instantánea
 *   2. En paralelo: QueryClient hace fetch normal en background
 *   3. Cuando llegan los datos frescos: React Query actualiza la UI automáticamente
 *   4. Tras cada fetch exitoso: guarda los datos en cache para la próxima vez
 */
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  loadAllCacheEntries,
  saveCacheEntry,
  pruneCacheDB,
  PERSISTED_QUERY_KEYS,
} from '@/lib/persistCache';

export function useSmartCache() {
  const queryClient = useQueryClient();
  const hydratedRef = useRef(false);

  // ── Hydration: carga el cache en memoria al arrancar ─────────────────────
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    (async () => {
      const entries = await loadAllCacheEntries();
      if (entries.length === 0) return;

      for (const entry of entries) {
        const currentData = queryClient.getQueryData([entry.queryKey]);
        // Solo hidratar si aún no hay datos en memoria (evitar reemplazar datos frescos)
        if (!currentData && entry.data) {
          queryClient.setQueryData([entry.queryKey], entry.data, {
            updatedAt: entry.savedAt,
          });
        }
      }

      // Limpiar entradas viejas en background
      pruneCacheDB();
    })();
  }, [queryClient]);

  // ── Observer: persiste datos frescos del servidor en IndexedDB ───────────
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      // Solo guardar cuando una query cargó datos nuevos exitosamente
      if (event.type !== 'updated') return;
      if (event.query.state.status !== 'success') return;
      if (event.query.state.fetchStatus !== 'idle') return;

      const key = event.query.queryKey?.[0];
      if (!key || !PERSISTED_QUERY_KEYS.includes(key)) return;

      const data = event.query.state.data;
      if (!data) return;

      // Guardar en background sin bloquear la UI
      saveCacheEntry(key, data);
    });

    return unsubscribe;
  }, [queryClient]);
}