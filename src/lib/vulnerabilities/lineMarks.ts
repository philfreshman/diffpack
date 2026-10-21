import { anchorOfLine, formatLineAnchor } from "#/lib/diff/lineAnchor.ts";
import type { DiffLine } from "#/lib/diff/parseUnifiedDiff.ts";
import { groupBy } from "./json.ts";
import type { AffectedFile, LineMark } from "./types.ts";

const MIN_SNIPPET_LENGTH = 8;
const MAX_SNIPPET_MATCHES = 2;
const HAS_WORD_CHARACTER = /[\p{L}\p{N}]/u;
const WHITESPACE_RUN = /\s+/g;
const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;
const METHOD_MODIFIERS =
	"(?:(?:public|private|protected|static|async|abstract|final|override|readonly|export|default|get|set|pub(?:\\([^)]*\\))?)\\s+)*";

interface DiffSide {
	holds(line: DiffLine): boolean;
	change: DiffLine["type"];
}

const OLD_SIDE: DiffSide = {
	holds: (line) => line.oldNumber !== null,
	change: "removed",
};

const NEW_SIDE: DiffSide = {
	holds: (line) => line.newNumber !== null,
	change: "added",
};

function definitionPatternsOf(name: string): RegExp[] {
	const symbol = name.replace(REGEX_SPECIALS, "\\$&");
	return [
		new RegExp(`\\bfunc\\s+(?:\\([^)]*\\)\\s*)?${symbol}\\s*[([]`),
		new RegExp(`\\bfn\\s+${symbol}\\s*[<(]`),
		new RegExp(`\\bfunction\\s*\\*?\\s*&?\\s*${symbol}\\s*[<(]`),
		new RegExp(`\\bdef\\s+${symbol}\\s*[([]`),
		new RegExp(
			`\\b(?:const|let|var)\\s+${symbol}\\s*=\\s*(?:async\\s+)?(?:function\\b|\\([^)]*\\)\\s*=>|[\\w$]+\\s*=>)`,
		),
		new RegExp(
			`^\\s*${METHOD_MODIFIERS}\\*?${symbol}\\s*\\([^)]*\\)\\s*(?::[^;{]+)?\\{\\s*$`,
		),
	];
}

function normalized(text: string): string {
	return text.trim().replace(WHITESPACE_RUN, " ");
}

function isSnippet(text: string): boolean {
	return text.length >= MIN_SNIPPET_LENGTH && HAS_WORD_CHARACTER.test(text);
}

function snippetsOf(lines: string[]): Set<string> {
	return new Set(lines.map(normalized).filter(isSnippet));
}

function preferredMatches(matches: DiffLine[], side: DiffSide): DiffLine[] {
	const changed = matches.filter((line) => line.type === side.change);
	return changed.length > 0 ? changed : matches;
}

function snippetLines(
	lines: DiffLine[],
	snippets: string[],
	side: DiffSide,
): DiffLine[] {
	const byText = groupBy(lines.filter(side.holds), (line) =>
		normalized(line.content),
	);
	return [...snippetsOf(snippets)]
		.map((snippet) => byText.get(snippet) ?? [])
		.filter((matches) => matches.length <= MAX_SNIPPET_MATCHES)
		.flatMap((matches) => preferredMatches(matches, side));
}

export function markLines(
	lines: DiffLine[],
	affected: AffectedFile,
): LineMark[] {
	const definitions = affected.symbols.flatMap(definitionPatternsOf);
	const marked = new Set([
		...snippetLines(lines, affected.removedLines, OLD_SIDE),
		...snippetLines(lines, affected.addedLines, NEW_SIDE),
	]);
	const isMarked = (line: DiffLine) =>
		marked.has(line) ||
		definitions.some((pattern) => pattern.test(line.content));

	return mergedMarks(lines.filter(isMarked), affected.advisoryIds);
}

function mergedMarks(lines: DiffLine[], advisoryIds: string[]): LineMark[] {
	const byAnchor = new Map<string, LineMark>();
	for (const line of lines) {
		const anchor = anchorOfLine(line);
		if (anchor === null) continue;
		const key = formatLineAnchor(anchor);
		if (!byAnchor.has(key))
			byAnchor.set(key, { anchor, advisoryIds: [...advisoryIds] });
	}
	return [...byAnchor.values()];
}
