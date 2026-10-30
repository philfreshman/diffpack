import { describe, expect, test } from "bun:test";
import {
	currentFileIndex,
	diffStat,
	estimatedRows,
	FILE_LAYOUTS,
	nextUnviewed,
	reviewProgress,
	STAT_BLOCKS,
} from "#/lib/review/fileStream.ts";
import type { DiffFileEntry } from "#/lib/worker/protocol.ts";

function file(path: string, added = 1, removed = 0): DiffFileEntry {
	return { path, type: "file", status: "modified", added, removed };
}

const FILES = [file("a.js"), file("b.js"), file("c.js"), file("d.js")];

describe("the file layouts", () => {
	test("offer one file at a time first, then all files", () => {
		expect(FILE_LAYOUTS).toEqual(["single", "all"]);
	});
});

describe("reviewProgress", () => {
	test("counts only the comparison's files as viewed", () => {
		const viewed = new Set(["a.js", "gone.js"]);

		expect(reviewProgress(FILES, viewed)).toEqual({
			viewed: 1,
			total: 4,
			done: false,
		});
	});

	test("is done once every file is viewed", () => {
		const viewed = new Set(FILES.map((entry) => entry.path));

		expect(reviewProgress(FILES, viewed).done).toBe(true);
	});

	test("is never done with nothing to review", () => {
		expect(reviewProgress([], new Set()).done).toBe(false);
	});
});

describe("nextUnviewed", () => {
	test("is the first unviewed file after the current one", () => {
		const viewed = new Set(["b.js"]);

		expect(nextUnviewed(FILES, viewed, 0)?.path).toBe("c.js");
	});

	test("wraps to the start past the last file", () => {
		const viewed = new Set(["c.js", "d.js"]);

		expect(nextUnviewed(FILES, viewed, 2)?.path).toBe("a.js");
	});

	test("comes back to the current file when it is the only one left", () => {
		const viewed = new Set(["a.js", "c.js", "d.js"]);

		expect(nextUnviewed(FILES, viewed, 1)?.path).toBe("b.js");
	});

	test("is nothing once every file is viewed", () => {
		const viewed = new Set(FILES.map((entry) => entry.path));

		expect(nextUnviewed(FILES, viewed, 0)).toBeUndefined();
	});
});

describe("diffStat", () => {
	test("always has five blocks", () => {
		for (const [added, removed] of [
			[0, 0],
			[1, 0],
			[3, 900],
			[120, 4],
		] as const) {
			expect(diffStat(added, removed)).toHaveLength(STAT_BLOCKS);
		}
	});

	test("splits the blocks by the share of added and removed lines", () => {
		expect(diffStat(60, 40)).toEqual([
			"added",
			"added",
			"added",
			"removed",
			"removed",
		]);
	});

	test("fills only as many blocks as lines changed", () => {
		expect(diffStat(1, 1)).toEqual([
			"added",
			"removed",
			"neutral",
			"neutral",
			"neutral",
		]);
	});

	test("is all neutral for a file with no changed lines", () => {
		expect(new Set(diffStat(0, 0))).toEqual(new Set(["neutral"]));
	});
});

describe("estimatedRows", () => {
	test("grows with the changed lines, plus some context", () => {
		expect(estimatedRows(file("a.js", 10, 5))).toBeGreaterThan(15);
	});

	test("is a fold for a file with no changed lines", () => {
		expect(estimatedRows(file("a.js", 0, 0))).toBeLessThan(5);
	});

	test("is capped, so a huge file does not reserve pages of blank space", () => {
		expect(estimatedRows(file("a.js", 50_000, 0))).toBeLessThan(1000);
	});
});

describe("currentFileIndex", () => {
	const TOPS = [0, 400, 900];

	test("is the last file whose top has scrolled past", () => {
		expect(currentFileIndex(TOPS, 650)).toBe(1);
	});

	test("counts a top exactly at the offset as reached", () => {
		expect(currentFileIndex(TOPS, 900)).toBe(2);
	});

	test("is the first file before any top is reached", () => {
		expect(currentFileIndex([120, 400], 0)).toBe(0);
	});
});
