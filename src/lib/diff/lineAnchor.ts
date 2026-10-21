import type { LaidOutRow } from "#/lib/diff/changes.ts";
import { CONTEXT_LINES, type LineRange } from "#/lib/diff/computeVisibility.ts";
import type { DiffLine } from "#/lib/diff/parseUnifiedDiff.ts";

export interface LineAnchor {
	side: "old" | "new";
	number: number;
}

const OLD_SIDE_PREFIX = "-";

const ANCHOR_PATTERN = /^#?(-?)([1-9]\d*)$/;

export function parseLineAnchor(hash: string): LineAnchor | null {
	const match = ANCHOR_PATTERN.exec(hash);
	if (!match) return null;

	return {
		side: match[1] === OLD_SIDE_PREFIX ? "old" : "new",
		number: Number(match[2]),
	};
}

export function formatLineAnchor(anchor: LineAnchor): string {
	const prefix = anchor.side === "old" ? OLD_SIDE_PREFIX : "";
	return `${prefix}${anchor.number}`;
}

export function anchorOfLine(line: DiffLine): LineAnchor | null {
	if (line.newNumber !== null) return { side: "new", number: line.newNumber };
	if (line.oldNumber !== null) return { side: "old", number: line.oldNumber };
	return null;
}

function isAnchoredLine(line: DiffLine, anchor: LineAnchor): boolean {
	const number = anchor.side === "new" ? line.newNumber : line.oldNumber;
	return number === anchor.number;
}

export function isAnchoredRow(row: LaidOutRow, anchor: LineAnchor): boolean {
	return linesOfRow(row).some((line) => isAnchoredLine(line, anchor));
}

export function anchoredRowIndex(
	rows: readonly LaidOutRow[],
	anchor: LineAnchor,
): number {
	return rows.findIndex((row) => isAnchoredRow(row, anchor));
}

export function anchoredLineIndex(
	lines: readonly DiffLine[],
	anchor: LineAnchor,
): number {
	return lines.findIndex((line) => isAnchoredLine(line, anchor));
}

export function rangeAroundLine(index: number): LineRange {
	return {
		start: Math.max(0, index - CONTEXT_LINES),
		end: index + CONTEXT_LINES,
	};
}

function linesOfRow(row: LaidOutRow): DiffLine[] {
	if (row.kind === "collapsed") return [];
	if (row.kind === "line") return [row.line];
	return [row.left?.line, row.right?.line].filter(
		(line): line is DiffLine => line !== undefined,
	);
}
