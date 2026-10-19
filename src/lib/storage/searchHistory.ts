import type { SearchResult } from "#/lib/registries/types.ts";

/** A contract with returning visitors: the old app kept ten entries. */
export const HISTORY_LIMIT = 10;

function isResult(value: unknown): value is SearchResult {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as SearchResult).name === "string"
	);
}

export function parseHistory(raw: string | null): SearchResult[] {
	if (!raw) return [];

	try {
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(isResult).slice(0, HISTORY_LIMIT);
	} catch {
		return [];
	}
}

export function addToHistory(
	history: readonly SearchResult[],
	result: SearchResult,
): SearchResult[] {
	const rest = history.filter((entry) => entry.name !== result.name);
	return [result, ...rest].slice(0, HISTORY_LIMIT);
}
