import { anchorOfLine, formatLineAnchor } from "#/lib/diff/lineAnchor.ts";
import type { DiffLine } from "#/lib/diff/parseUnifiedDiff.ts";
import { groupBy } from "./json.ts";
import type { AffectedFile, LineMark } from "./types.ts";

const MIN_SNIPPET_LENGTH = 8;
const MAX_SNIPPET_MATCHES = 2;
const HAS_WORD_CHARACTER = /[\p{L}\p{N}]/u;
const WHITESPACE_RUN = /\s+/g;
const QUALIFIER_SEPARATOR = ".";
const DEFINITION_PATTERNS = [
	/\bfunc\s+(?:\([^)]*\)\s*)?(?<name>[\p{L}\p{N}_$]+)\s*[([]/gu,
	/\bfn\s+(?<name>[\p{L}\p{N}_$]+)\s*[<(]/gu,
	/\bfunction\s*\*?\s*&?\s*(?<name>[\p{L}\p{N}_$]+)\s*[<(]/gu,
	/\bdef\s+(?<name>[\p{L}\p{N}_$]+)\s*[([]/gu,
	/\b(?:const|let|var)\s+(?<name>[\p{L}\p{N}_$]+)\s*=\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*=>|[\w$]+\s*=>)/gu,
	/^\s*(?:(?:public|private|protected|static|async|abstract|final|override|readonly|export|default|get|set|pub(?:\([^)]*\))?)\s+)*\*?(?<name>[\p{L}\p{N}_$]+)\s*\([^)]*\)\s*(?::[^;{]+)?\{\s*$/gu,
];

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

function definedNamesOf(content: string): string[] {
	return DEFINITION_PATTERNS.flatMap((pattern) =>
		[...content.matchAll(pattern)].map((match) => match.groups?.name ?? ""),
	);
}

function unqualified(symbol: string): string {
	return symbol.slice(symbol.lastIndexOf(QUALIFIER_SEPARATOR) + 1);
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
	const symbols = new Set(affected.symbols.map(unqualified));
	const marked = new Set([
		...snippetLines(lines, affected.removedLines, OLD_SIDE),
		...snippetLines(lines, affected.addedLines, NEW_SIDE),
	]);
	const isMarked = (line: DiffLine) =>
		marked.has(line) ||
		(symbols.size > 0 &&
			definedNamesOf(line.content).some((name) => symbols.has(name)));

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
