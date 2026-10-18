import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { RegistryAdapter, SearchResult } from "#/lib/registries/types.ts";

const MIN_QUERY_LENGTH = 2;

const SEARCH_DEBOUNCE_MS = 300;

function useDebouncedValue<T>(value: T, delay: number): T {
	const [debounced, setDebounced] = useState(value);

	useEffect(() => {
		const timer = setTimeout(() => setDebounced(value), delay);
		return () => clearTimeout(timer);
	}, [value, delay]);

	return debounced;
}

export interface PackageSearch {
	results: SearchResult[];
	loading: boolean;
	searching: boolean;
}

export function usePackageSearch(
	adapter: RegistryAdapter,
	query: string,
): PackageSearch {
	const trimmed = query.trim();
	const debounced = useDebouncedValue(trimmed, SEARCH_DEBOUNCE_MS);
	const enabled = debounced.length >= MIN_QUERY_LENGTH;

	const { data, isFetching } = useQuery({
		queryKey: ["search", adapter.id, debounced],
		queryFn: ({ signal }) => adapter.search(debounced, signal),
		enabled,
	});

	// Loading during the debounce too, so old results never pass as this query's.
	const pending = trimmed !== debounced && trimmed.length >= MIN_QUERY_LENGTH;

	return {
		results: enabled ? (data ?? []) : [],
		loading: pending || (enabled && isFetching),
		searching: enabled || pending,
	};
}
