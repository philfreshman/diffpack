import type { DiffRow } from "#/lib/diff/computeVisibility.ts";
import type { DiffLine } from "#/lib/diff/parseUnifiedDiff.ts";

export type SplitSide = { index: number; line: DiffLine } | null;

export type SplitRow =
	| { kind: "pair"; left: SplitSide; right: SplitSide }
	| Extract<DiffRow, { kind: "collapsed" }>;

export function pairSplitRows(rows: DiffRow[]): SplitRow[] {
	const split: SplitRow[] = [];
	let run: { left: SplitSide[]; right: SplitSide[] } | null = null;

	const closeRun = () => {
		if (!run) return;
		const { left, right } = run;
		run = null;
		for (let r = 0; r < Math.max(left.length, right.length); r++) {
			split.push({
				kind: "pair",
				left: left[r] ?? null,
				right: right[r] ?? null,
			});
		}
	};

	for (const row of rows) {
		if (row.kind === "collapsed") {
			closeRun();
			split.push(row);
			continue;
		}

		const side = { index: row.index, line: row.line };
		if (row.line.type === "unchanged") {
			closeRun();
			split.push({ kind: "pair", left: side, right: side });
			continue;
		}

		// The engine interleaves removals and additions rather than grouping them.
		run ??= { left: [], right: [] };
		(row.line.type === "removed" ? run.left : run.right).push(side);
	}
	closeRun();

	return split;
}
