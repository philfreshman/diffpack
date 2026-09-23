import { describe, expect, test } from "bun:test";
import { rowChange } from "#/lib/diff/changes.ts";
import { type FileModel, fileModel, parseFile } from "#/lib/diff/fileModel.ts";
import type { RowSpan } from "#/lib/diff/scrollbar.ts";
import {
	emptyMemory,
	type FileView,
	fileView,
	withExpandAll,
	withRevealed,
} from "#/lib/diff/viewMemory.ts";

const PATH = "index.js";

/** `n` untouched lines, as the engine writes them. */
function untouched(n: number, from: number): string[] {
	return Array.from({ length: n }, (_, i) => `  line ${from + i}`);
}

/**
 * Three differences with long untouched runs between them, so the file folds:
 * a two-line replacement (lines 10–13, removals and additions interleaved the
 * way the engine emits them), a two-line addition (34–35) and a removal (56).
 */
const FILE = parseFile(PATH, {
	isDiff: true,
	data: [
		"--- from/index.js",
		"+++ to/index.js",
		...untouched(10, 1),
		"- one",
		"+ ONE",
		"- two",
		"+ TWO",
		...untouched(20, 11),
		"+ added",
		"+ added again",
		...untouched(20, 31),
		"- gone",
		...untouched(10, 51),
	].join("\n"),
});

/** The line each difference starts on, whichever row it has ended up in. */
const DIFFERENCES = [10, 34, 56];
const [REPLACED = 0] = DIFFERENCES;

const FOLDED = fileView(emptyMemory(), PATH);
const EXPANDED = fileView(withExpandAll(emptyMemory(), PATH, true), PATH);

const VIEWS: [string, FileView, boolean][] = [
	["folded", FOLDED, false],
	["folded and split", FOLDED, true],
	["expanded", EXPANDED, false],
	["expanded and split", EXPANDED, true],
];

/** Every row the arrows stop at, pressing "next" from above the first row. */
function walkDown(model: FileModel): number[] {
	const stops: number[] = [];
	let at = model.nextDifference(-1, 1);
	while (at !== undefined) {
		stops.push(at);
		at = model.nextDifference(at, 1);
	}
	return stops;
}

/** The first line of the file a row shows, on either side of it. */
function firstLine(model: FileModel, index: number): number {
	const row = model.rows[index];
	const shown = row?.kind === "pair" ? (row.left ?? row.right) : row;
	if (!shown || !("line" in shown)) throw new Error(`row ${index} is a fold`);

	return shown.index;
}

/** What a file measures with nothing wrapped: every row one pixel tall. */
function evenSpans(model: FileModel): RowSpan[] {
	return model.rows.map((_, index) => ({ start: index, end: index + 1 }));
}

describe.each(VIEWS)("%s", (_, view, split) => {
	const model = fileModel(FILE, view, split);

	test("counts exactly the differences the arrows stop at", () => {
		// The count and the arrows come from the same rows, so however the file
		// is shown, pressing "next" from the top visits as many as it says.
		expect(walkDown(model)).toEqual(model.stops);
		expect(model.differences).toBe(model.stops.length);
		expect(model.differences).toBe(DIFFERENCES.length);
	});

	test("stops at the first line of each difference", () => {
		expect(model.stops.map((stop) => firstLine(model, stop))).toEqual(
			DIFFERENCES,
		);
	});

	test("the minimap has a band at every stop", () => {
		// Both ask `rowChange`, so the arrows cannot stop somewhere the
		// scrollbar left unmarked.
		const starts = model.markers(evenSpans(model)).map((it) => it.start);

		for (const stop of model.stops) {
			expect(starts).toContain(stop / model.rows.length);
		}
	});
});

describe("stepping through the differences", () => {
	const model = fileModel(FILE, FOLDED, false);
	const [first = 0, second = 0, last = 0] = model.stops;

	test("goes to the next difference below the row the reader is on", () => {
		// The reader part-way into a difference has read its start already, so
		// "next" is the one after it rather than a jump back up.
		expect(model.nextDifference(0, 1)).toBe(first);
		expect(model.nextDifference(first, 1)).toBe(second);
		expect(model.nextDifference(first + 1, 1)).toBe(second);
	});

	test("goes to the difference above, not back to the one it is in", () => {
		expect(model.nextDifference(second, -1)).toBe(first);
		expect(model.nextDifference(second + 1, -1)).toBe(second);
	});

	test("stops at the ends of the file rather than wrapping round", () => {
		expect(model.nextDifference(last, 1)).toBeUndefined();
		expect(model.nextDifference(first, -1)).toBeUndefined();
	});

	test("a file nothing happened to has nothing to count or step to", () => {
		const unchanged = fileModel(
			parseFile("README.md", { isDiff: false, data: "one\ntwo" }),
			FOLDED,
			false,
		);

		expect(unchanged.differences).toBe(0);
		expect(unchanged.nextDifference(-1, 1)).toBeUndefined();
	});
});

describe("expanding and folding the whole file", () => {
	test("moves the stops to where the differences now are", () => {
		const folded = fileModel(FILE, FOLDED, false);
		const expanded = fileModel(FILE, EXPANDED, false);

		// Every line is its own row once nothing is folded, so the stops are the
		// lines themselves — further down than the folded rows put them.
		expect(expanded.stops).toEqual(DIFFERENCES);
		expect(folded.stops).not.toEqual(expanded.stops);
		expect(expanded.expandAll).toBe(true);
	});

	test("folding it back puts every stop back where it was", () => {
		const opened = withExpandAll(emptyMemory(), PATH, true);
		const refolded = withExpandAll(opened, PATH, false);

		expect(fileModel(FILE, fileView(refolded, PATH), false).stops).toEqual(
			fileModel(FILE, FOLDED, false).stops,
		);
	});
});

describe("opening a fold", () => {
	test("moves the stops below it down, and leaves the ones above", () => {
		const folded = fileModel(FILE, FOLDED, false);
		const fold = folded.rows.find(
			(row) => row.kind === "collapsed" && row.start > REPLACED,
		);
		if (fold?.kind !== "collapsed") throw new Error("no fold to open");

		const memory = withRevealed(emptyMemory(), PATH, {
			direction: "all",
			start: fold.start,
			end: fold.end,
		});
		const opened = fileModel(FILE, fileView(memory, PATH), false);

		// One fold row became one row per line it held.
		const [above = 0, ...below] = folded.stops;
		expect(opened.stops).toEqual([
			above,
			...below.map((stop) => stop + fold.count - 1),
		]);
		expect(opened.differences).toBe(folded.differences);
	});
});

describe("switching to split view", () => {
	test("sets a replacement's two sides opposite each other, as one stop", () => {
		const unified = fileModel(FILE, FOLDED, false);
		const split = fileModel(FILE, FOLDED, true);
		const changes = (model: FileModel) =>
			model.rows.map(rowChange).filter((change) => change !== null);

		// Two removals and two additions are four rows one after the other, and
		// two rows side by side — both of them one difference.
		expect(changes(unified).slice(0, 4)).toEqual([
			"removed",
			"added",
			"removed",
			"added",
		]);
		expect(changes(split).slice(0, 2)).toEqual(["modified", "modified"]);
		expect(split.differences).toBe(unified.differences);
	});
});
