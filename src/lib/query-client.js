import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			staleTime: 1000 * 60 * 2,      // datos frescos por 2 min — evita refetches al cambiar de tab
			gcTime: 1000 * 60 * 10,         // mantener en caché 10 min
		},
	},
});