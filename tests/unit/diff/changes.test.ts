import { describe, expect, test } from "bun:test";
import { rowChange } from "#/lib/diff/changes.ts";
import type { DiffRow } from "#/lib/diff/computeVisibility.ts";
import type { SplitRow } from "#/lib/diff/pairSplitRows.ts";
import type { DiffLine } from "#/lib/diff/parseUnifiedDiff.ts";

function line(type: DiffLine["type"]): DiffLine {
	return { type, content: "", oldNumber: null, newNumber: null };
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
