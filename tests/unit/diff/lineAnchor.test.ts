import { describe, expect, test } from "bun:test";
import { computeVisibility } from "#/lib/diff/computeVisibility.ts";
import {
	anchoredLineIndex,
	anchoredRowIndex,
	anchorOfLine,
	formatLineAnchor,
	isAnchoredRow,
	parseLineAnchor,
	rangeAroundLine,
} from "#/lib/diff/lineAnchor.ts";
import { pairSplitRows } from "#/lib/diff/pairSplitRows.ts";
import type { DiffLine } from "#/lib/diff/parseUnifiedDiff.ts";
import { emptyMemory, fileView } from "#/lib/diff/viewMemory.ts";

const unchanged = (oldNumber: number, newNumber: number): DiffLine => ({
	type: "unchanged",
	content: `line ${newNumber}`,
	oldNumber,
	newNumber,
});

const LINES: DiffLine[] = [
	...Array.from({ length: 30 }, (_, i) => unchanged(i + 1, i + 1)),
	{ type: "removed", content: "gone", oldNumber: 31, newNumber: null },
	{ type: "added", content: "new", oldNumber: null, newNumber: 31 },
	...Array.from({ length: 30 }, (_, i) => unchanged(i + 32, i + 32)),
];

describe("reading an anchor", () => {
	test("a bare number is a line of the new version", () => {
		expect(parseLineAnchor("42")).toEqual({ side: "new", number: 42 });
	});

	test("a leading minus is a line of the old version", () => {
		expect(parseLineAnchor("-42")).toEqual({ side: "old", number: 42 });
	});

	test("takes the hash with or without its #", () => {
		expect(parseLineAnchor("#7")).toEqual({ side: "new", number: 7 });
	});

	test("anything else names no line", () => {
		for (const hash of [
			"",
			"#",
			"0",
			"-0",
			"L42",
			"4.2",
			"042",
			"42a",
			"--4",
		]) {
			expect(parseLineAnchor(hash)).toBeNull();
		}
	});

	test("writes back what it reads", () => {
		for (const hash of ["42", "-42"]) {
			const anchor = parseLineAnchor(hash);
			if (!anchor) throw new Error(`${hash} did not parse`);
			expect(formatLineAnchor(anchor)).toBe(hash);
		}
	});
});

describe("the anchor a line links to", () => {
	test("is its new-version number when it has one", () => {
		expect(anchorOfLine(unchanged(3, 5))).toEqual({ side: "new", number: 5 });
	});

	test("is its old-version number for a removed line", () => {
		const removed = LINES[30];
		if (!removed) throw new Error("no removed line");
		expect(anchorOfLine(removed)).toEqual({ side: "old", number: 31 });
	});
});

describe("finding an anchored line", () => {
	test("tells a removed line from the added line with the same number", () => {
		expect(anchoredLineIndex(LINES, { side: "old", number: 31 })).toBe(30);
		expect(anchoredLineIndex(LINES, { side: "new", number: 31 })).toBe(31);
	});

	test("a number past the end is not found", () => {
		expect(anchoredLineIndex(LINES, { side: "new", number: 999 })).toBe(-1);
	});

	test("a line inside a fold has no row until the fold opens", () => {
		const rows = computeVisibility(LINES, fileView(emptyMemory(), "a.js"));

		expect(anchoredRowIndex(rows, { side: "new", number: 2 })).toBe(-1);
		expect(anchoredLineIndex(LINES, { side: "new", number: 2 })).toBe(1);
	});

	test("in split view, either half of a pair holds the anchor", () => {
		const rows = pairSplitRows(
			computeVisibility(LINES, fileView(emptyMemory(), "a.js")),
		);
		const removed = anchoredRowIndex(rows, { side: "old", number: 31 });
		const added = anchoredRowIndex(rows, { side: "new", number: 31 });
		const row = rows[added];

		expect(removed).toBe(added);
		expect(row && isAnchoredRow(row, { side: "new", number: 31 })).toBe(true);
	});
});

describe("revealing an anchored line", () => {
	test("opens it with a little context on both sides", () => {
		expect(rangeAroundLine(10)).toEqual({ start: 7, end: 13 });
	});

	test("never reaches before the first line", () => {
		expect(rangeAroundLine(1)).toEqual({ start: 0, end: 4 });
	});
});
