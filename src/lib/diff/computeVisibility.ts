import type { DiffLine } from "#/lib/diff/parseUnifiedDiff.ts";

export type DiffRow =
	| { kind: "line"; index: number; line: DiffLine }
	| {
			kind: "collapsed";
			start: number;
			end: number;
			count: number;
			expanders: Expander[];
	  };

export interface LineRange {
	start: number;
	end: number;
}

export interface Expander extends LineRange {
	direction: "up" | "down" | "all";
}

export interface DiffView {
	expanded: ReadonlySet<number>;
	expandAll: boolean;
}

export const CONTEXT_LINES = 3;

const EXPAND_STEP = 20;

export function computeVisibility(
	lines: DiffLine[],
	view: DiffView,
): DiffRow[] {
	const shown = visibleFlags(lines, view);
	const rows: DiffRow[] = [];
	let foldStart: number | null = null;

	const closeFold = (end: number) => {
		if (foldStart === null) return;
		rows.push({
			kind: "collapsed",
			start: foldStart,
			end,
			count: end - foldStart + 1,
			expanders: expandersFor(foldStart, end, lines.length),
		});
		foldStart = null;
	};

	for (const [index, line] of lines.entries()) {
		if (!shown[index]) {
			foldStart ??= index;
			continue;
		}

		closeFold(index - 1);
		rows.push({ kind: "line", index, line });
	}
	closeFold(lines.length - 1);

	return rows;
}

function visibleFlags(lines: DiffLine[], view: DiffView): boolean[] {
	// An unchanged file folded would be one fold and nothing else.
	const unchangedFile = lines.every((line) => line.type === "unchanged");
	if (view.expandAll || unchangedFile) {
		return new Array<boolean>(lines.length).fill(true);
	}

	const shown = new Array<boolean>(lines.length).fill(false);

	for (const [index, line] of lines.entries()) {
		// A line revealed by hand brings no context, or a click would reveal more than it offered.
		if (view.expanded.has(index)) shown[index] = true;
		if (line.type === "unchanged") continue;

		shown[index] = true;
		for (let step = 1; step <= CONTEXT_LINES; step++) {
			if (index - step >= 0) shown[index - step] = true;
			if (index + step < lines.length) shown[index + step] = true;
		}
	}

	return shown;
}

// A fold touching the top or bottom only opens whole: a partial reveal would leave a sliver at the edge.
function expandersFor(start: number, end: number, total: number): Expander[] {
	const whole: Expander = { direction: "all", start, end };
	if (start === 0 || end === total - 1) return [whole];

	return [
		{ direction: "down", start, end: Math.min(start + EXPAND_STEP - 1, end) },
		{ direction: "up", start: Math.max(start, end - EXPAND_STEP + 1), end },
		whole,
	];
}
