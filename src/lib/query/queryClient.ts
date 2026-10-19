import { QueryClient } from "@tanstack/react-query";

export function createQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 5 * 60_000,
				gcTime: 30 * 60_000,
				retry: 1,
				refetchOnWindowFocus: false,
			},
		},
	});
}
