import { describe, expect, test } from "bun:test";
import {
	countDifferences,
	differenceRows,
	rowChange,
	stepDifference,
} from "#/lib/diff/changes.ts";
import type { DiffRow } from "#/lib/diff/computeVisibility.ts";
import type { SplitRow } from "#/lib/diff/pairSplitRows.ts";
import type { DiffLine } from "#/lib/diff/parseUnifiedDiff.ts";

function line(type: DiffLine["type"]): DiffLine {
	return { type, content: "", oldNumber: null, newNumber: null };
}

function lines(types: DiffLine["type"][]): DiffLine[] {
	return types.map(line);
}

function unified(types: DiffLine["type"][]): DiffRow[] {
	return types.map((type, index) => ({
		kind: "line",
		index,
		line: line(type),
	}));
}

const fold: DiffRow = {
	kind: "collapsed",
	start: 0,
	end: 9,
	count: 10,
	expanders: [],
};

describe("countDifferences", () => {
	test("counts a run of touched lines once", () => {
		// Three lines replaced by two is one edit, not five.
		expect(
			countDifferences(
				lines([
					"unchanged",
					"removed",
					"removed",
					"removed",
					"added",
					"added",
					"unchanged",
				]),
			),
		).toBe(1);
	});

	test("counts each run the unchanged lines separate", () => {
		expect(
			countDifferences(
				lines(["added", "unchanged", "removed", "unchanged", "added"]),
			),
		).toBe(3);
	});

	test("a file with nothing touched has no differences", () => {
		expect(countDifferences(lines(["unchanged", "unchanged"]))).toBe(0);
		expect(countDifferences([])).toBe(0);
	});
});

describe("differenceRows", () => {
	test("stops at the first row of each run, not at every touched row", () => {
		expect(
			differenceRows(
				unified([
					"unchanged",
					"removed",
					"added",
					"unchanged",
					"unchanged",
					"added",
				]),
			),
		).toEqual([1, 5]);
	});

	test("a fold is unchanged, and ends the run before it", () => {
		// It stands in for untouched lines; the run after it is a new stop, so
		// opening a fold cannot merge two differences into one.
		expect(
			differenceRows([...unified(["added"]), fold, ...unified(["added"])]),
		).toEqual([0, 2]);
	});

	test("takes a split pair as changed when either side is", () => {
		const rows: SplitRow[] = [
			{
				kind: "pair",
				left: { index: 0, line: line("unchanged") },
				right: { index: 0, line: line("unchanged") },
			},
			{ kind: "pair", left: { index: 1, line: line("removed") }, right: null },
			{ kind: "pair", left: null, right: { index: 2, line: line("added") } },
		];

		// The removal and the addition set against it are one difference seen
		// twice, which is the whole point of reading a diff this way.
		expect(differenceRows(rows)).toEqual([1]);
	});
});

describe("rowChange", () => {
	const side = (type: DiffLine["type"]) => ({ index: 0, line: line(type) });

	test("a line is what happened to it, and an untouched one is nothing", () => {
		expect(unified(["added", "removed", "unchanged"]).map(rowChange)).toEqual([
			"added",
			"removed",
			null,
		]);
	});

	test("a fold is never a change: it only ever holds untouched lines", () => {
		expect(rowChange(fold)).toBeNull();
	});

	test("a split pair is a change when either side is one", () => {
		// The arrows and the minimap both ask this, so the pair that counts as a
		// stop is the pair that gets a band.
		const pairs: SplitRow[] = [
			{ kind: "pair", left: side("removed"), right: side("added") },
			{ kind: "pair", left: side("removed"), right: null },
			{ kind: "pair", left: null, right: side("added") },
			{ kind: "pair", left: side("unchanged"), right: side("unchanged") },
		];

		expect(pairs.map(rowChange)).toEqual([
			"modified",
			"removed",
			"added",
			null,
		]);
	});
});

describe("stepDifference", () => {
	const stops = [4, 12, 30];

	test("goes to the next stop below where the reader is", () => {
		expect(stepDifference(stops, 0, 1)).toBe(4);
		expect(stepDifference(stops, 4, 1)).toBe(12);
	});

	test("goes to the last stop above where the reader is", () => {
		expect(stepDifference(stops, 30, -1)).toBe(12);
		expect(stepDifference(stops, 13, -1)).toBe(12);
	});

	test("stops at the ends of the file rather than wrapping round", () => {
		expect(stepDifference(stops, 30, 1)).toBeUndefined();
		expect(stepDifference(stops, 4, -1)).toBeUndefined();
		expect(stepDifference([], 0, 1)).toBeUndefined();
	});
});
