import { type EntryBoot, readEntryBoot } from "#/lib/worker/bootScript.ts";
import { type DiffClient, diffClient } from "#/lib/worker/diffWorkerClient.ts";
import {
	type Comparison,
	comparisonKey,
	type DiffFileEntry,
	type DiffRequest,
	type FileDiff,
	type OnArchiveFetched,
} from "#/lib/worker/protocol.ts";
import {
	type CachedEntry,
	cachedEntryFrom,
	lookUpEntry,
} from "./entryLookup.ts";

type LookUp = (comparison: Comparison) => Promise<CachedEntry | null>;

interface CachedComparison {
	key: string;
	entry: CachedEntry;
	builtHere: Promise<DiffFileEntry> | null;
}

function createBootClaim(boot: () => EntryBoot | null) {
	let claimed = false;

	return {
		claim(comparison: Comparison): EntryBoot | null {
			if (claimed) return null;
			claimed = true;

			const booted = boot();
			if (!booted) return null;
			if (comparisonKey(booted.comparison) === comparisonKey(comparison))
				return booted;

			booted.abandoned = true;
			return null;
		},

		async settled(): Promise<void> {
			await boot()?.served.catch(() => null);
		},
	};
}

function buildHere(
	local: DiffClient,
	comparison: Comparison,
	cached: CachedComparison,
): Promise<unknown> {
	cached.builtHere ??= local.buildTree(comparison).catch((error: unknown) => {
		cached.builtHere = null;
		throw error;
	});
	return cached.builtHere;
}

async function fileOfCached(
	local: DiffClient,
	comparison: Comparison,
	cached: CachedComparison,
	path: string,
	oldPath: string | undefined,
): Promise<FileDiff> {
	const patch = cached.entry.patches.get(path);
	if (patch) return patch;

	await buildHere(local, comparison, cached);
	return local.getFile(comparison, path, oldPath);
}

export function createCachedDiffClient(
	local: DiffClient,
	lookUp: LookUp,
	boot: () => EntryBoot | null = readEntryBoot,
) {
	const bootClaim = createBootClaim(boot);
	let held: CachedComparison | null = null;

	async function findEntry(
		comparison: Comparison,
	): Promise<CachedEntry | null> {
		const booted = bootClaim.claim(comparison);
		if (booted) return cachedEntryFrom(await booted.served, comparison);

		return lookUp(comparison);
	}

	return {
		async buildTree(
			comparison: Comparison,
			onProgress?: OnArchiveFetched,
		): Promise<DiffFileEntry> {
			const entry = await findEntry(comparison).catch(() => null);
			if (!entry) {
				held = null;
				return local.buildTree(comparison, onProgress);
			}

			held = { key: comparisonKey(comparison), entry, builtHere: null };
			return entry.tree;
		},

		getFile(
			comparison: Comparison,
			path: string,
			oldPath: string | undefined,
		): Promise<FileDiff> {
			if (held?.key === comparisonKey(comparison))
				return fileOfCached(local, comparison, held, path, oldPath);

			return local.getFile(comparison, path, oldPath);
		},

		async prefetch(request: DiffRequest): Promise<void> {
			await bootClaim.settled();
			return local.prefetch(request);
		},
	};
}

export const cachedDiffClient = createCachedDiffClient(diffClient, lookUpEntry);
