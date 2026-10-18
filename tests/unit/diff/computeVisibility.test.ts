import { describe, expect, test } from "bun:test";
import { computeVisibility } from "#/lib/diff/computeVisibility.ts";
import type { DiffLine } from "#/lib/diff/parseUnifiedDiff.ts";

function unchanged(n: number): DiffLine {
	return {
		type: "unchanged",
		content: `line ${n}`,
		oldNumber: n,
		newNumber: n,
	};
}

function removed(n: number): DiffLine {
	return {
		type: "removed",
		content: `gone ${n}`,
		oldNumber: n,
		newNumber: null,
	};
}

function changeSurroundedBy(n: number): DiffLine[] {
	const before = Array.from({ length: n }, (_, i) => unchanged(i + 1));
	const after = Array.from({ length: n }, (_, i) => unchanged(n + i + 2));
	return [...before, removed(n + 1), ...after];
}

const TWO_CHANGES_FAR_APART: DiffLine[] = Array.from({ length: 241 }, (_, i) =>
	i === 60 || i === 180 ? removed(i + 1) : unchanged(i + 1),
);

function folds(lines: DiffLine[]) {
	return computeVisibility(lines, NOTHING_EXPANDED).filter(
		(row) => row.kind === "collapsed",
	);
}

const NOTHING_EXPANDED = { expanded: new Set<number>(), expandAll: false };

describe("computeVisibility", () => {
	test("keeps three lines either side of a change and folds the rest away", () => {
		const rows = computeVisibility(changeSurroundedBy(10), NOTHING_EXPANDED);

		expect(rows.map((row) => row.kind)).toEqual([
			"collapsed",
			"line",
			"line",
			"line",
			"line",
			"line",
			"line",
			"line",
			"collapsed",
		]);
		expect(rows[0]).toMatchObject({ kind: "collapsed", start: 0, end: 6 });
		expect(rows[8]).toMatchObject({ kind: "collapsed", start: 14, end: 20 });
	});

	test("reveals exactly the lines asked for, and folds what is still left", () => {
		const rows = computeVisibility(changeSurroundedBy(10), {
			expanded: new Set([0, 1]),
			expandAll: false,
		});

		expect(rows.slice(0, 3)).toMatchObject([
			{ kind: "line", index: 0, line: unchanged(1) },
			{ kind: "line", index: 1, line: unchanged(2) },
			{ kind: "collapsed", start: 2, end: 6, count: 5 },
		]);
	});

	test("expand-all leaves nothing folded", () => {
		const rows = computeVisibility(changeSurroundedBy(10), {
			expanded: new Set(),
			expandAll: true,
		});

		expect(rows).toHaveLength(21);
		expect(rows.every((row) => row.kind === "line")).toBe(true);
	});

	test("a file with no changes in it is shown whole", () => {
		const rows = computeVisibility(
			[unchanged(1), unchanged(2), unchanged(3)],
			NOTHING_EXPANDED,
		);

		expect(rows.map((row) => row.kind)).toEqual(["line", "line", "line"]);
	});

	test("a fold in the middle of a file opens from either end, 20 at a time", () => {
		const middle = folds(TWO_CHANGES_FAR_APART)[1];

		expect(middle).toMatchObject({ start: 64, end: 176 });
		expect(middle?.expanders).toEqual([
			{ direction: "down", start: 64, end: 83 },
			{ direction: "up", start: 157, end: 176 },
			{ direction: "all", start: 64, end: 176 },
		]);
	});

	test("a fold against the edge of the file only opens whole", () => {
		const [first, , last] = folds(TWO_CHANGES_FAR_APART);

		expect(first?.expanders).toEqual([{ direction: "all", start: 0, end: 56 }]);
		expect(last?.expanders).toEqual([
			{ direction: "all", start: 184, end: 240 },
		]);
	});
});
