import type { DiffRow } from "#/lib/diff/computeVisibility.ts";
import type { SplitRow } from "#/lib/diff/pairSplitRows.ts";
import type { DiffLine } from "#/lib/diff/parseUnifiedDiff.ts";

/** A row of either layout: both are read for changes the same way. */
export type LaidOutRow = DiffRow | SplitRow;

/** What happened to a row: the minimap colours its band by this. */
export type Change = "added" | "removed" | "modified";

/**
 * What happened to a row, or `null` when nothing did.
 *
 * The one place that says whether a row is a change. The toolbar's arrows stop
 * at the first row of each run of these and the scrollbar marks them, so two
 * rules would let the minimap mark a row the arrows walk past.
 */
export function rowChange(row: LaidOutRow): Change | null {
	if (row.kind === "collapsed") return null;
	if (row.kind === "line") return lineChange(row.line);

	// Side by side, a removal and the addition set opposite it are one change
	// seen twice, and a change with only one side is that side's alone. An
	// unchanged line is set opposite itself, so neither side is a change.
	const left = lineChange(row.left?.line);
	const right = lineChange(row.right?.line);
	if (left && right) return "modified";

	return left ?? right;
}

function lineChange(line: DiffLine | undefined): Change | null {
	return !line || line.type === "unchanged" ? null : line.type;
}
