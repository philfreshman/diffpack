import type { SearchResult } from "#/lib/registries/types.ts";

/**
 * Per-registry recent picks, shown when the search field is focused and empty.
 * The cap is a contract with existing users: the old app kept ten entries, and
 * their history should survive the rebuild. Where each registry's list is
 * stored is declared with every other setting, in `settings.ts`.
 */
export const HISTORY_LIMIT = 10;

function isResult(value: unknown): value is SearchResult {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as SearchResult).name === "string"
	);
}

/**
 * What is in storage is whatever a previous version of the app — or the user
 * with devtools open — put there, so nothing about its shape is assumed.
 */
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

/** Most recent first, one entry per package, capped. */
export function addToHistory(
	history: readonly SearchResult[],
	result: SearchResult,
): SearchResult[] {
	const rest = history.filter((entry) => entry.name !== result.name);
	return [result, ...rest].slice(0, HISTORY_LIMIT);
}
