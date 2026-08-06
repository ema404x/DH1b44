import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			refetchOnReconnect: 'stale',
			retry: false,                    // sin retry: errores de red se resuelven con datos de cache
			staleTime: 1000 * 60 * 10,
			gcTime: 1000 * 60 * 20,          // 20 min en RAM (más hits en cache entre navegaciones)
			networkMode: 'offlineFirst',
			// Refetch al montar solo si la data está stale (age > staleTime). Con staleTime
			// 10min la data fresca no se re-pide (sin impacto en performance), pero al
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