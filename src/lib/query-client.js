import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			refetchOnReconnect: true,        // re-fetch al recuperar conexión
			retry: 1,
			staleTime: 1000 * 60 * 10,      // datos frescos por 10 min
			gcTime: 1000 * 60 * 60,          // mantener en caché 1 hora
			networkMode: 'offlineFirst',     // usa datos en caché si no hay red
		},
		mutations: {
			networkMode: 'offlineFirst',     // permite mutations en modo offline (queued)
		},
	},
});