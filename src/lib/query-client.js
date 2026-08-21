import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			refetchOnReconnect: 'stale',
			// Reintento corto con backoff exponencial para blips transitorios de red.
			// Si igual falla, React Query muestra el dato de cache (networkMode
			// offlineFirst) en vez de un error en pantalla — sensación premium.
			retry: (count) => count < 2,
			retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
			staleTime: 1000 * 60 * 5,
			gcTime: 1000 * 60 * 20,          // 20 min en RAM (más hits en cache entre navegaciones)
			networkMode: 'offlineFirst',
			// Refetch al montar solo si la data está stale (age > staleTime). Con staleTime
			// 5min la data fresca no se re-pide (sin impacto en performance), pero al
			// navegar a una página con data vieja se refresca sola — evita totales y
			// listas desactualizadas en todos los módulos.
			refetchOnMount: true,
		},
		mutations: {
			networkMode: 'offlineFirst',
			retry: false,
		},
	},
});