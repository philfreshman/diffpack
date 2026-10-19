import type { Fetcher } from "#/lib/registries/types.ts";
import type {
	Comparison,
	DiffFileEntry,
	FileDiff,
} from "#/lib/worker/protocol.ts";
import {
	CACHE_SCHEMA,
	comparisonDiffKey,
	type DiffKey,
	diffId,
} from "./diffKey.ts";

const CACHED_REGISTRIES: readonly string[] = ["npm", "crates", "pypi"];

export interface CachedEntry {
	tree: DiffFileEntry;
	patches: Record<string, FileDiff>;
}

interface ServedPatch {
	data: string;
	is_diff: boolean;
}

interface ServedEntry {
	engine: string;
	registry: string;
	package: string;
	from: string;
	to: string;
	ignore_whitespace: boolean;
	tree: DiffFileEntry;
	patches: Record<string, ServedPatch>;
}

export interface EntryLookupOptions {
	fetcher: Fetcher;
	origin: string;
	engine?: string;
	timeoutMs: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isServedPatch(value: unknown): value is ServedPatch {
	return (
		isRecord(value) &&
		typeof value.data === "string" &&
		typeof value.is_diff === "boolean"
	);
}

function isServedEntry(value: unknown): value is ServedEntry {
	return (
		isRecord(value) &&
		isRecord(value.tree) &&
		typeof value.tree.path === "string" &&
		isRecord(value.patches) &&
		Object.values(value.patches).every(isServedPatch)
	);
}

function describes(served: ServedEntry, key: DiffKey): boolean {
	return (
		served.engine === key.engine &&
		served.registry === key.registry &&
		served.package === key.package &&
		served.from === key.from &&
		served.to === key.to &&
		served.ignore_whitespace === key.ignoreWhitespace
	);
}

async function servedEntryIn(
	response: Response,
	key: DiffKey,
): Promise<ServedEntry | null> {
	if (!response.ok) return null;

	const body: unknown = await response.json();
	return isServedEntry(body) && describes(body, key) ? body : null;
}

function cachedEntryOf(served: ServedEntry): CachedEntry {
	const patches = Object.fromEntries(
		Object.entries(served.patches).map(([path, patch]) => [
			path,
			{ data: patch.data, isDiff: patch.is_diff },
		]),
	);
	return { tree: served.tree, patches };
}

export function createEntryLookup({
	fetcher,
	origin,
	engine,
	timeoutMs,
}: EntryLookupOptions) {
	async function fetchEntry(
		comparison: Comparison,
	): Promise<ServedEntry | null> {
		const key = comparisonDiffKey(comparison, engine);
		const response = await fetcher(
			`${origin}/diffs/v${CACHE_SCHEMA}/${await diffId(key)}`,
			{
				credentials: "omit",
				referrerPolicy: "no-referrer",
				signal: AbortSignal.timeout(timeoutMs),
			},
		);
		return servedEntryIn(response, key);
	}

	return async function lookUp(
		comparison: Comparison,
	): Promise<CachedEntry | null> {
		if (!CACHED_REGISTRIES.includes(comparison.registry)) return null;

		try {
			const served = await fetchEntry(comparison);
			return served && cachedEntryOf(served);
		} catch {
			return null;
		}
	};
}

const CACHE_ORIGIN =
	import.meta.env.VITE_DIFFPACK_CACHE_ORIGIN ?? "https://mcp.diffpack.io";

const LOOKUP_TIMEOUT_MS = 1500;

export const lookUpEntry = createEntryLookup({
	fetcher: fetch,
	origin: CACHE_ORIGIN,
	timeoutMs: LOOKUP_TIMEOUT_MS,
});
