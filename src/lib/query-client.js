import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			refetchOnReconnect: true,        // re-fetch al recuperar conexión
			retry: 1,
			staleTime: 1000 * 60 * 5,        // datos frescos por 5 min
			gcTime: 1000 * 60 * 5,           // liberar de RAM tras 5 min sin uso
			networkMode: 'offlineFirst',     // usa datos en caché si no hay red
		},
		mutations: {
			networkMode: 'offlineFirst',     // permite mutations en modo offline (queued)
		},
	},
});