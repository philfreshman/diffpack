import { describe, expect, test } from "bun:test";
import { parseUnifiedDiff } from "#/lib/diff/parseUnifiedDiff.ts";

describe("parseUnifiedDiff numbering and headers", () => {
	test("numbers each line against the sides it exists on", () => {
		const lines = parseUnifiedDiff({
			isDiff: true,
			data: ["  one", "- two", "+ dos", "  three"].join("\n"),
		});

		expect(
			lines.map((line) => [line.type, line.oldNumber, line.newNumber]),
		).toEqual([
			["unchanged", 1, 1],
			["removed", 2, null],
			["added", null, 2],
			["unchanged", 3, 3],
		]);
	});

	test("the file's own header is not a line of it", () => {
		const lines = parseUnifiedDiff({
			isDiff: true,
			data: ["--- from/index.js", "+++ to/index.js", "  one"].join("\n"),
		});

		expect(lines).toEqual([
			{ type: "unchanged", content: "one", oldNumber: 1, newNumber: 1 },
		]);
	});

	test("an added or removed file's header is not a line of it either", () => {
		const added = parseUnifiedDiff({
			isDiff: true,
			data: ["--- /dev/null", "+++ to/index.js", "+ one"].join("\n"),
		});
		const removed = parseUnifiedDiff({
			isDiff: true,
			data: ["--- from/index.js", "+++ /dev/null", "- one"].join("\n"),
		});

		expect(added).toEqual([
			{ type: "added", content: "one", oldNumber: null, newNumber: 1 },
		]);
		expect(removed).toEqual([
			{ type: "removed", content: "one", oldNumber: 1, newNumber: null },
		]);
	});
});

describe("parseUnifiedDiff reading markers", () => {
	test("a file that did not change is all of it, unmarked", () => {
		// The engine returns an unchanged file as its raw content: no markers, no header.
		const lines = parseUnifiedDiff({
			isDiff: false,
			data: ["const x = 1;", "--- from/README"].join("\n"),
		});

		expect(lines).toEqual([
			{
				type: "unchanged",
				content: "const x = 1;",
				oldNumber: 1,
				newNumber: 1,
			},
			{
				type: "unchanged",
				content: "--- from/README",
				oldNumber: 2,
				newNumber: 2,
			},
		]);
	});

	test("tells the marker apart from text that looks like one", () => {
		// Only the first two characters are the marker.
		const lines = parseUnifiedDiff({
			isDiff: true,
			data: ["  - kept item", "- - dropped item", "+   indented"].join("\n"),
		});

		expect(lines.map((line) => [line.type, line.content])).toEqual([
			["unchanged", "- kept item"],
			["removed", "- dropped item"],
			["added", "  indented"],
		]);
	});
});
