import { type LaidOutRow, rowChange } from "#/lib/diff/changes.ts";
import {
	computeVisibility,
	type DiffRow,
} from "#/lib/diff/computeVisibility.ts";
import { detectLanguage } from "#/lib/diff/highlight.ts";
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

/**
 * The open file as read once. Nothing the reader does to the view changes
 * what the file says or what it is written in, so this is worked out once per
 * file rather than once per view of it.
 */
export interface ParsedFile {
	path: string;
	/** Every line the file has, folds and all — what the gutter is sized from. */
	lines: DiffLine[];
	/** What the file was taken to be written in. */
	language: string | null;
}

/**
 * The file on screen as the toolbar and the viewer both read it: the rows to
 * draw, and the differences among them, from one layout of one parse.
 */
export interface FileModel extends ParsedFile {
	/** The rows on screen: folded, and paired into two columns when split. */
	rows: DiffRow[] | SplitRow[];
	/**
	 * How many differences the file has: the rows `nextDifference` stops at,
	 * counted. Which rows those are is the model's own business.
	 */
	differences: number;
	/** Whether the whole file is open, folds and all. */
	expandAll: boolean;
	/** Where the file was left scrolled to, in the scroller's pixels. */
	scrollTop: number;
	/**
	 * The difference after row `from` (`1`) or before it (`-1`), or
	 * `undefined` at the end of the file — the arrows stop there rather than
	 * wrapping, so paging through a file has an end the reader can feel.
	 */
	nextDifference(from: number, direction: 1 | -1): number | undefined;
	/**
	 * The changes as bands down the scrollbar, given how tall each row
	 * measures — which only the view can say, since rows wrap.
	 */
	markers(spans: readonly RowSpan[]): Marker[];
}

/** The file read once: parsed, and its language decided. */
export function parseFile(path: string, diff: FileDiff): ParsedFile {
	const lines = parseUnifiedDiff(diff);

	// Decided once for the whole file: per line it would be both slower and
	// inconsistent, since a line like `}` tells a highlighter nothing.
	return { path, lines, language: detectLanguage(path, lines) };
}

/**
 * The file laid out for one view of it: how much of it is open, and which of
 * the two layouts it is shown in.
 */
export function fileModel(
	file: ParsedFile,
	view: FileView,
	split: boolean,
): FileModel {
	const unified = computeVisibility(file.lines, view);
	// Split view is the same rows in two columns, so the folds survive it as
	// full-width rows rather than being paired against anything.
	const rows = split ? pairSplitRows(unified) : unified;
	const stops = differenceStops(rows);

	return {
		...file,
		rows,
		// Counted from the stops, so the number and the arrows cannot disagree.
		// It is the same number whichever way the file is shown: a fold only
		// ever holds untouched lines, and pairing keeps a run of changes
		// together, so no view splits one difference or joins two.
		differences: stops.length,
		expandAll: view.expandAll,
		scrollTop: view.scrollTop,
		nextDifference: (from, direction) => nextStop(stops, from, direction),
		markers: (spans) => changeMarkers(rows, spans),
	};
}

/**
 * The first row of each run of changed rows. A removal and the addition that
 * replaced it are read as one edit — they are one row apart in the unified
 * view and opposite each other in the split one — so a run ends only where
 * the file goes back to being unchanged.
 *
 * It is taken from the rows rather than from the lines because that is what
 * the arrows scroll to: folds and split pairing both change which row a given
 * line ended up in, and a stale index would scroll to the wrong place.
 */
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
