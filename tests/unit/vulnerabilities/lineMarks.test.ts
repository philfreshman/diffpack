import { describe, expect, test } from "bun:test";
import type { DiffLine } from "#/lib/diff/parseUnifiedDiff.ts";
import { markLines } from "#/lib/vulnerabilities/lineMarks.ts";
import type { AffectedFile } from "#/lib/vulnerabilities/types.ts";

function unchanged(content: string, number: number): DiffLine {
	return { type: "unchanged", content, oldNumber: number, newNumber: number };
}

function removed(content: string, number: number): DiffLine {
	return { type: "removed", content, oldNumber: number, newNumber: null };
}

function added(content: string, number: number): DiffLine {
	return { type: "added", content, oldNumber: null, newNumber: number };
}

function file(fields: Partial<AffectedFile>): AffectedFile {
	return {
		path: "x",
		advisoryIds: ["OSV-1"],
		symbols: [],
		removedLines: [],
		addedLines: [],
		...fields,
	};
}

function markedNumbers(contents: string[], symbol: string): number[] {
	const lines = contents.map((content, index) => unchanged(content, index + 1));
	return markLines(lines, file({ symbols: [symbol] })).map(
		({ anchor }) => anchor.number,
	);
}

describe("a symbol", () => {
	test.each([
		["Go function", "func Render(w io.Writer, n *Node) error {", "Render"],
		["Go method", "func (p *parser) render1(w writer) error {", "render1"],
		[
			"Go method named by its type",
			"func (z *Tokenizer) Next() TokenType {",
			"Tokenizer.Next",
		],
		["Go generic", "func Map[T any](s []T) {", "Map"],
		["Rust function", "    pub fn abort(&self) {", "abort"],
		["Rust generic", "pub(crate) fn close<T>(self) {", "close"],
		["JS function", "function trimEnd(string, chars, guard) {", "trimEnd"],
		["JS generator", "export function* walk(node) {", "walk"],
		["JS arrow", "const toNumber = (value) => {", "toNumber"],
		["JS method", "  async close() {", "close"],
		["TS method", "  public parse(input: string): Node {", "parse"],
		["PHP function", "    public static function decode($json)", "decode"],
		["Python def", "    def render(self, *args):", "render"],
	])("marks the definition of a %s", (_, line, symbol) => {
		expect(markedNumbers(["", line], symbol)).toEqual([2]);
	});

	test.each([
		["a call", "  return Render(w, n)", "Render"],
		["a call statement", "  handle.abort();", "abort"],
		["a longer name", "func RenderAll(w io.Writer) {", "Render"],
		["a name ending the same", "function _trimEnd(string) {", "trimEnd"],
		["a mention in text", "// abort() cancels the task", "abort"],
	])("leaves %s unmarked", (_, line, symbol) => {
		expect(markedNumbers([line], symbol)).toEqual([]);
	});

	test("treats regex characters in a name literally", () => {
		expect(
			markedNumbers(["function $a(x) {", "function xa(x) {"], "$a"),
		).toEqual([1]);
	});
});

const lines: DiffLine[] = [
	unchanged("var reWhitespace = /\\s/;", 1),
	removed("  while (index-- && reWhitespace.test(x)) {}", 2),
	added("  while (index-- && reWhitespace.test(x)) {", 2),
	unchanged("  }", 3),
	unchanged("  return index;", 4),
];

describe("a fix commit's lines", () => {
	test("mark old-side lines a removal matches and new-side lines an addition matches", () => {
		const marks = markLines(
			lines,
			file({
				removedLines: ["while (index-- && reWhitespace.test(x)) {}"],
				addedLines: ["  while (index-- && reWhitespace.test(x)) {", "  }"],
			}),
		);

		expect(marks).toEqual([
			{ anchor: { side: "old", number: 2 }, advisoryIds: ["OSV-1"] },
			{ anchor: { side: "new", number: 2 }, advisoryIds: ["OSV-1"] },
		]);
	});

	test("mark an unchanged line on its new side", () => {
		const marks = markLines(
			lines,
			file({ removedLines: ["var reWhitespace = /\\s/;"] }),
		);
		expect(marks).toEqual([
			{ anchor: { side: "new", number: 1 }, advisoryIds: ["OSV-1"] },
		]);
	});

	test("never match a removal against an added line", () => {
		const marks = markLines(
			lines,
			file({ removedLines: ["  while (index-- && reWhitespace.test(x)) {"] }),
		);
		expect(marks).toEqual([]);
	});

	test("ignore short and punctuation-only snippets", () => {
		const marks = markLines(
			lines,
			file({ addedLines: ["  }", "return index;".slice(0, 7), "}); // --"] }),
		);
		expect(marks).toEqual([]);
	});
});

describe("a fix commit's lines, where more than one line could match", () => {
	test("mark a line once when a symbol and a snippet both match", () => {
		const marks = markLines(
			[unchanged("function trimEnd(string) {", 1)],
			file({
				advisoryIds: ["A", "B"],
				symbols: ["trimEnd"],
				addedLines: ["function trimEnd(string) {"],
			}),
		);
		expect(marks).toEqual([
			{ anchor: { side: "new", number: 1 }, advisoryIds: ["A", "B"] },
		]);
	});

	test("ignore a snippet that matches more than two lines on its side", () => {
		const common = [
			unchanged("  return result;", 1),
			added("  return result;", 2),
			unchanged("  return result;", 3),
		];
		expect(markLines(common, file({ addedLines: ["return result;"] }))).toEqual(
			[],
		);
	});

	test("mark both lines of a snippet that matches two context lines", () => {
		const twice = [
			unchanged("  return result;", 1),
			unchanged("  return result;", 2),
		];
		expect(
			markLines(twice, file({ removedLines: ["return result;"] })).map(
				({ anchor }) => anchor.number,
			),
		).toEqual([1, 2]);
	});

	test("prefer the changed line over a context line with the same text", () => {
		const both: DiffLine[] = [
			unchanged("  value = trim(value);", 1),
			removed("  value = trim(value);", 2),
		];
		expect(
			markLines(both, file({ removedLines: ["value = trim(value);"] })),
		).toEqual([{ anchor: { side: "old", number: 2 }, advisoryIds: ["OSV-1"] }]);
	});

	test("compare snippets with inner whitespace collapsed", () => {
		const marks = markLines(
			[unchanged("\treturn  a +\tb;", 1)],
			file({ addedLines: ["return a + b;"] }),
		);
		expect(marks).toHaveLength(1);
	});
});
