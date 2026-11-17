import { useContext } from 'react';
import { AuthContext } from '@/lib/AuthContext';
import { queryClientInstance } from '@/lib/query-client';

/** true solo cuando la app arrancó en modo sin conexión (beta). */
export function useOfflineMode() {
  return useContext(AuthContext)?.offlineMode === true;
}

/**
 * Opciones a agregar al final de un useQuery. Con offlineMode false devuelve {}
 * (la consulta queda exactamente como estaba). En modo sin conexión la consulta
 * no pide nada al servidor ni reintenta: muestra lo que haya en caché.
 * persistedKey: clave del caché persistido de la que tomar los datos guardados.
 */
export function offlineQueryOptions(offlineMode, persistedKey) {
  if (!offlineMode) return {};
  return {
    enabled: false,
    retry: false,
    ...(persistedKey
      ? { initialData: () => queryClientInstance.getQueryData([persistedKey]) }
      : {}),
  };
}