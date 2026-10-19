import type { Fetcher } from "#/lib/registries/types.ts";
import type {
	Comparison,
	DiffFileEntry,
	FileDiff,
} from "#/lib/worker/protocol.ts";
import {
	CACHE_SCHEMA,
	canonicalThreshold,
	comparisonDiffKey,
	type DiffKey,
	diffId,
} from "./diffKey.ts";

export interface CachedEntry {
	tree: DiffFileEntry;
	patches: ReadonlyMap<string, FileDiff>;
}

interface ServedPatch {
	data: string;
	is_diff: boolean;
}

interface ServedEntry {
	schema: number;
	similarity_threshold: number;
	engine: string;
	registry: string;
	package: string;
	from: string;
	to: string;
	ignore_whitespace: boolean;
	tree: DiffFileEntry;
	patches: Record<string, ServedPatch>;
}

interface EntryLookupOptions {
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
		served.schema === key.schema &&
		canonicalThreshold(served.similarity_threshold) ===
			canonicalThreshold(key.similarityThreshold) &&
		served.engine === key.engine &&
		served.registry === key.registry &&
		served.package === key.package &&
		served.from === key.from &&
		served.to === key.to &&
		served.ignore_whitespace === key.ignoreWhitespace
	);
}

function cachedEntryOf(served: ServedEntry): CachedEntry {
	const patches = new Map(
		Object.entries(served.patches).map(([path, patch]) => [
			path,
			{ data: patch.data, isDiff: patch.is_diff },
		]),
	);
	return { tree: served.tree, patches };
}

export function cachedEntryFrom(
	body: unknown,
	comparison: Comparison,
	engine?: string,
): CachedEntry | null {
	const key = comparisonDiffKey(comparison, engine);
	return isServedEntry(body) && describes(body, key)
		? cachedEntryOf(body)
		: null;
}

export function createEntryLookup({
	fetcher,
	origin,
	engine,
	timeoutMs,
}: EntryLookupOptions) {
	async function headersWithinTimeout(url: string): Promise<Response> {
		const answered = new AbortController();
		const giveUp = setTimeout(() => answered.abort(), timeoutMs);
		try {
			return await fetcher(url, {
				credentials: "omit",
				referrerPolicy: "no-referrer",
				signal: answered.signal,
			});
		} finally {
			clearTimeout(giveUp);
		}
	}

	async function fetchEntry(comparison: Comparison): Promise<unknown> {
		const id = await diffId(comparisonDiffKey(comparison, engine));
		const response = await headersWithinTimeout(
			`${origin}/diffs/v${CACHE_SCHEMA}/${id}`,
		);
		return response.ok ? response.json() : null;
	}

	return async function lookUp(
		comparison: Comparison,
	): Promise<CachedEntry | null> {
		try {
			return cachedEntryFrom(await fetchEntry(comparison), comparison, engine);
		} catch {
			return null;
		}
	};
}

export const CACHE_ORIGIN =
	import.meta.env.VITE_DIFFPACK_CACHE_ORIGIN ?? "https://mcp.diffpack.io";

export const LOOKUP_TIMEOUT_MS = 1500;

export const lookUpEntry = createEntryLookup({
	fetcher: fetch,
	origin: CACHE_ORIGIN,
	timeoutMs: LOOKUP_TIMEOUT_MS,
});
