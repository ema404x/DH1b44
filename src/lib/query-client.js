import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			refetchOnReconnect: 'stale',     // re-fetch solo si stale
			retry: 1,
			staleTime: 1000 * 60 * 10,       // datos frescos por 10 min (menos refetches)
			gcTime: 1000 * 60 * 15,          // liberar de RAM tras 15 min sin uso
			networkMode: 'offlineFirst',
		},
		mutations: {
			networkMode: 'offlineFirst',
		},
	},
});