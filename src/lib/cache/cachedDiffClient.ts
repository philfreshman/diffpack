import { type EntryBoot, readEntryBoot } from "#/lib/worker/bootScript.ts";
import { type DiffClient, diffClient } from "#/lib/worker/diffWorkerClient.ts";
import {
	type Comparison,
	comparisonKey,
	type DiffFileEntry,
	type DiffRequest,
	type FileDiff,
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

export function createCachedDiffClient(
	local: DiffClient,
	lookUp: LookUp,
	boot: () => EntryBoot | null = readEntryBoot,
) {
	let held: CachedComparison | null = null;
	let bootClaimed = false;

	function claimBoot(comparison: Comparison): EntryBoot | null {
		if (bootClaimed) return null;
		bootClaimed = true;

		const booted = boot();
		if (!booted) return null;
		if (comparisonKey(booted.comparison) === comparisonKey(comparison))
			return booted;

		booted.abandoned = true;
		return null;
	}

	async function bootSettled(): Promise<void> {
		await boot()?.served.catch(() => null);
	}

	async function findEntry(
		comparison: Comparison,
	): Promise<CachedEntry | null> {
		const booted = claimBoot(comparison);
		if (booted) return cachedEntryFrom(await booted.served, comparison);

		return lookUp(comparison);
	}

	function buildHere(
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
		comparison: Comparison,
		cached: CachedComparison,
		path: string,
		oldPath: string | undefined,
	): Promise<FileDiff> {
		const patch = cached.entry.patches.get(path);
		if (patch) return patch;

		await buildHere(comparison, cached);
		return local.getFile(comparison, path, oldPath);
	}

	return {
		async buildTree(comparison: Comparison): Promise<DiffFileEntry> {
			const entry = await findEntry(comparison).catch(() => null);
			if (!entry) {
				held = null;
				return local.buildTree(comparison);
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
				return fileOfCached(comparison, held, path, oldPath);

			return local.getFile(comparison, path, oldPath);
		},

		async prefetch(request: DiffRequest): Promise<void> {
			await bootSettled();
			return local.prefetch(request);
		},
	};
}

export const cachedDiffClient = createCachedDiffClient(diffClient, lookUpEntry);
