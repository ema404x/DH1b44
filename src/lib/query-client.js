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
			// Evita refetch en background cuando la pestaña vuelve a ser visible
			refetchOnMount: false,
		},
		mutations: {
			networkMode: 'offlineFirst',
			retry: false,
		},
	},
});