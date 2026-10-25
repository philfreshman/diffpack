import { describe, expect, test } from "bun:test";
import { computeVisibility } from "#/lib/diff/computeVisibility.ts";
import { inlineChange, inlineChanges } from "#/lib/diff/inlineChange.ts";
import { pairSplitRows } from "#/lib/diff/pairSplitRows.ts";
import type { DiffLine } from "#/lib/diff/parseUnifiedDiff.ts";

function line(type: DiffLine["type"], content: string): DiffLine {
	return { type, content, oldNumber: null, newNumber: null };
}

const SHOW_EVERYTHING = { expanded: new Set<number>(), expandAll: true };

function linesSetOppositeAChange(lines: DiffLine[]): number[] {
	return pairSplitRows(computeVisibility(lines, SHOW_EVERYTHING)).flatMap(
		(row) => {
			if (row.kind !== "pair" || !row.left || !row.right) return [];
			if (row.left.line.type !== "removed") return [];
			return [row.left.index, row.right.index];
		},
	);
}

describe("inlineChange", () => {
	test("marks only the part of a line that changed", () => {
		expect(
			inlineChange("this.effect.stop();", "this.reactiveEffect.stop();"),
		).toEqual({
			removed: { start: 5, end: 6 },
			added: { start: 5, end: 14 },
		});
	});

	test("leaves the removed side empty when text was only inserted", () => {
		expect(inlineChange("foo()", "foo(a)")).toEqual({
			removed: { start: 4, end: 4 },
			added: { start: 4, end: 5 },
		});
	});

	test("marks nothing when the lines share only indentation", () => {
		expect(inlineChange("\treturn a", "\tthrow b")).toBeNull();
	});

	test("marks nothing when the lines share nothing at all", () => {
		expect(inlineChange("open()", "close")).toBeNull();
	});

	test("keeps an emoji whole when it shares its first half with the other", () => {
		expect(inlineChange('x = "😀";', 'x = "😃";')).toEqual({
			removed: { start: 5, end: 7 },
			added: { start: 5, end: 7 },
		});
	});

	test("keeps an emoji whole when it shares its second half with the other", () => {
		expect(inlineChange('x = "😀";', 'x = "🈀";')).toEqual({
			removed: { start: 5, end: 7 },
			added: { start: 5, end: 7 },
		});
	});
});

describe("inlineChanges", () => {
	test("marks only the first removal of a run with fewer additions", () => {
		expect(
			inlineChanges([
				line("removed", "let a = 1;"),
				line("removed", "let b = 2;"),
				line("removed", "let c = 3;"),
				line("added", "let a = 9;"),
			]),
		).toEqual(
			new Map([
				[0, { start: 8, end: 9 }],
				[3, { start: 8, end: 9 }],
			]),
		);
	});

	test("pairs a removal with the first addition of an interleaved run", () => {
		expect(
			inlineChanges([
				line("added", "size = 2"),
				line("removed", "size = 1"),
				line("added", "count = 0"),
			]),
		).toEqual(
			new Map([
				[0, { start: 7, end: 8 }],
				[1, { start: 7, end: 8 }],
			]),
		);
	});

	test("gives the untouched side of a pure insertion no entry", () => {
		expect(
			inlineChanges([
				line("unchanged", "start();"),
				line("removed", "foo()"),
				line("added", "foo(a)"),
			]),
		).toEqual(new Map([[2, { start: 4, end: 5 }]]));
	});

	test("marks exactly the lines split view sets opposite each other", () => {
		const lines = [
			line("unchanged", "ctx"),
			line("removed", "val = 1"),
			line("added", "val = 2"),
			line("removed", "val = 3"),
			line("unchanged", "ctx"),
			line("added", "val = 4"),
			line("removed", "val = 5"),
			line("added", "val = 6"),
			line("removed", "val = 7"),
			line("removed", "val = 8"),
			line("added", "val = 9"),
		];

		expect([...inlineChanges(lines).keys()].sort((a, b) => a - b)).toEqual(
			linesSetOppositeAChange(lines).sort((a, b) => a - b),
		);
	});
});
