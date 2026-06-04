import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			refetchOnReconnect: false,
			retry: 1,
			staleTime: 1000 * 60 * 10,     // datos frescos por 10 min (menos re-fetches)
			gcTime: 1000 * 60 * 60,         // mantener en caché 1 hora (menos re-descargas)
		},
	},
});