import { useQuery } from "@tanstack/react-query";
import type { RegistryAdapter } from "#/lib/registries/types.ts";

// Shared so `list` keeps its identity and effects on it do not refire.
const NONE: string[] = [];

export interface Versions {
	list: string[];
	loading: boolean;
	error: Error | null;
}

export function useVersions(
	adapter: RegistryAdapter,
	packageName: string,
): Versions {
	const name = packageName.trim();

	const { data, isFetching, error } = useQuery({
		queryKey: ["versions", adapter.id, name],
		queryFn: ({ signal }) => adapter.versions(name, signal),
		enabled: name.length > 0,
	});

	return {
		list: data ?? NONE,
		loading: name.length > 0 && isFetching,
		error: error as Error | null,
	};
}
