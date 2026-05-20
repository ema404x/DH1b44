import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			refetchOnReconnect: false,
			retry: 1,
			staleTime: 1000 * 60 * 5,      // datos frescos por 5 min
			gcTime: 1000 * 60 * 30,         // mantener en caché 30 min
		},
	},
});