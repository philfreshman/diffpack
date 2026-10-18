import { describe, expect, test } from "bun:test";
import { computeVisibility } from "#/lib/diff/computeVisibility.ts";
import { pairSplitRows } from "#/lib/diff/pairSplitRows.ts";
import type { DiffLine } from "#/lib/diff/parseUnifiedDiff.ts";

function line(type: DiffLine["type"], content: string): DiffLine {
	return { type, content, oldNumber: null, newNumber: null };
}

const SHOW_EVERYTHING = { expanded: new Set<number>(), expandAll: true };

function sideBySide(lines: DiffLine[]) {
	return pairSplitRows(computeVisibility(lines, SHOW_EVERYTHING)).map((row) =>
		row.kind === "collapsed"
			? "collapsed"
			: [row.left?.line.content ?? null, row.right?.line.content ?? null],
	);
}

describe("pairSplitRows", () => {
	test("sets a removal opposite the addition that replaced it", () => {
		expect(
			sideBySide([
				line("unchanged", "before"),
				line("removed", "was"),
				line("added", "is"),
				line("unchanged", "after"),
			]),
		).toEqual([
			["before", "before"],
			["was", "is"],
			["after", "after"],
		]);
	});

	test("leaves the shorter side of an uneven change empty", () => {
		expect(
			sideBySide([
				line("removed", "a"),
				line("removed", "b"),
				line("removed", "c"),
				line("added", "z"),
			]),
		).toEqual([
			["a", "z"],
			["b", null],
			["c", null],
		]);
	});

	test("pairs a run whatever order the two kinds arrive in", () => {
		// The engine interleaves removals and additions rather than grouping them.
		expect(
			sideBySide([
				line("added", "z"),
				line("removed", "a"),
				line("added", "y"),
			]),
		).toEqual([
			["a", "z"],
			[null, "y"],
		]);
	});

	test("a fold stays one row across both columns", () => {
		const lines = Array.from({ length: 60 }, (_, i) =>
			line(i === 30 ? "removed" : "unchanged", `line ${i}`),
		);
		const rows = pairSplitRows(
			computeVisibility(lines, { expanded: new Set(), expandAll: false }),
		);

		expect(rows.filter((row) => row.kind === "collapsed")).toHaveLength(2);
		expect(rows[0]).toMatchObject({ kind: "collapsed", start: 0, end: 26 });
	});
});
