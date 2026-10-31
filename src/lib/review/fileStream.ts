import type { DiffFileEntry } from "#/lib/worker/protocol.ts";

export const FILE_LAYOUTS = ["single", "all"] as const;
export type FileLayout = (typeof FILE_LAYOUTS)[number];

export function nextUnviewed(
	files: readonly DiffFileEntry[],
	viewed: ReadonlySet<string>,
	after: number,
): DiffFileEntry | undefined {
	const wrapped = [...files.slice(after + 1), ...files.slice(0, after + 1)];

	return wrapped.find((entry) => !viewed.has(entry.path));
}

export type StatBlock = "added" | "removed" | "neutral";

export const STAT_BLOCKS = 5;

export function diffStat(added: number, removed: number): StatBlock[] {
	const changed = added + removed;
	if (changed === 0) return new Array<StatBlock>(STAT_BLOCKS).fill("neutral");

	const shownBlocks = Math.min(STAT_BLOCKS, changed);
	const addedBlocks = Math.round((added / changed) * shownBlocks);
	const removedBlocks = shownBlocks - addedBlocks;

	return [
		...new Array<StatBlock>(addedBlocks).fill("added"),
		...new Array<StatBlock>(removedBlocks).fill("removed"),
		...new Array<StatBlock>(STAT_BLOCKS - shownBlocks).fill("neutral"),
	];
}

const CONTEXT_ROWS_PER_CHANGE = 6;
const FOLD_ROWS = 2;
const MAX_ESTIMATED_ROWS = 400;

export function estimatedRows(entry: DiffFileEntry): number {
	const changed = (entry.added ?? 0) + (entry.removed ?? 0);
	if (changed === 0) return FOLD_ROWS;

	return Math.min(
		MAX_ESTIMATED_ROWS,
		changed + CONTEXT_ROWS_PER_CHANGE + FOLD_ROWS,
	);
}

export function currentFileIndex(
	tops: readonly number[],
	offset: number,
): number {
	const passedCount = tops.filter((top) => top <= offset).length;

	return Math.max(0, passedCount - 1);
}
