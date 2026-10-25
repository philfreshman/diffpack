import { type LaidOutRow, rowChange } from "#/lib/diff/changes.ts";
import {
	computeVisibility,
	type DiffRow,
} from "#/lib/diff/computeVisibility.ts";
import { detectLanguage } from "#/lib/diff/highlight.ts";
import { inlineChanges, type TextRange } from "#/lib/diff/inlineChange.ts";
import { pairSplitRows, type SplitRow } from "#/lib/diff/pairSplitRows.ts";
import {
	type DiffLine,
	parseUnifiedDiff,
} from "#/lib/diff/parseUnifiedDiff.ts";
import {
	changeMarkers,
	type Marker,
	type RowSpan,
} from "#/lib/diff/scrollbar.ts";
import type { FileView } from "#/lib/diff/viewMemory.ts";
import type { FileDiff } from "#/lib/worker/protocol.ts";

export interface ParsedFile {
	path: string;
	lines: DiffLine[];
	language: string | null;
	changes: ReadonlyMap<number, TextRange>;
}

export interface FileModel extends ParsedFile {
	rows: DiffRow[] | SplitRow[];
	split: boolean;
	differences: number;
	expandAll: boolean;
	scrollTop: number;
	/** `undefined` past the last difference: the arrows do not wrap. */
	nextDifference(from: number, direction: 1 | -1): number | undefined;
	markers(spans: readonly RowSpan[]): Marker[];
}

export function parseFile(path: string, diff: FileDiff): ParsedFile {
	const lines = parseUnifiedDiff(diff);

	return {
		path,
		lines,
		language: detectLanguage(path, lines),
		changes: inlineChanges(lines),
	};
}

export function fileModel(
	file: ParsedFile,
	view: FileView,
	split: boolean,
): FileModel {
	const unified = computeVisibility(file.lines, view);
	const rows = split ? pairSplitRows(unified) : unified;
	const stops = differenceStops(rows);

	return {
		...file,
		rows,
		split,
		// Counted from the stops so the number and the arrows cannot disagree.
		differences: stops.length,
		expandAll: view.expandAll,
		scrollTop: view.scrollTop,
		nextDifference: (from, direction) => nextStop(stops, from, direction),
		markers: (spans) => changeMarkers(rows, spans),
	};
}

// Row indices, not line indices: the arrows scroll to rows, and folds and
// split pairing move which row a line lands in.
function differenceStops(rows: readonly LaidOutRow[]): number[] {
	const stops: number[] = [];
	let inRun = false;

	rows.forEach((row, index) => {
		const changed = rowChange(row) !== null;
		if (changed && !inRun) stops.push(index);
		inRun = changed;
	});

	return stops;
}

function nextStop(
	stops: readonly number[],
	from: number,
	direction: 1 | -1,
): number | undefined {
	if (direction === 1) return stops.find((stop) => stop > from);

	for (let i = stops.length - 1; i >= 0; i--) {
		const stop = stops[i];
		if (stop !== undefined && stop < from) return stop;
	}

	return undefined;
}
