import type { DiffRow } from "#/lib/diff/computeVisibility.ts";
import type { SplitRow } from "#/lib/diff/pairSplitRows.ts";
import type { DiffLine } from "#/lib/diff/parseUnifiedDiff.ts";

export type LaidOutRow = DiffRow | SplitRow;

export type Change = "added" | "removed" | "modified";

export function rowChange(row: LaidOutRow): Change | null {
	if (row.kind === "collapsed") return null;
	if (row.kind === "line") return lineChange(row.line);

	const left = lineChange(row.left?.line);
	const right = lineChange(row.right?.line);
	if (left && right) return "modified";

	return left ?? right;
}

function lineChange(line: DiffLine | undefined): Change | null {
	return !line || line.type === "unchanged" ? null : line.type;
}
