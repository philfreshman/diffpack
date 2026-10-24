import type { DiffLine } from "#/lib/diff/parseUnifiedDiff.ts";

export interface TextRange {
	start: number;
	end: number;
}

export interface InlineChange {
	removed: TextRange;
	added: TextRange;
}

export function inlineChange(
	before: string,
	after: string,
): InlineChange | null {
	const prefix = commonPrefixLength(before, after);
	const suffix = commonSuffixLength(before, after, prefix);
	if (isBlank(before.slice(0, prefix) + before.slice(before.length - suffix))) {
		return null;
	}

	return {
		removed: { start: prefix, end: before.length - suffix },
		added: { start: prefix, end: after.length - suffix },
	};
}

interface ChangedLine {
	index: number;
	content: string;
}

export function inlineChanges(
	lines: DiffLine[],
): ReadonlyMap<number, TextRange> {
	const ranges = new Map<number, TextRange>();
	let removals: ChangedLine[] = [];
	let additions: ChangedLine[] = [];

	const closeRun = () => {
		for (const [pair, removal] of removals.entries()) {
			const addition = additions[pair];
			if (!addition) break;
			markPair(removal, addition, ranges);
		}
		removals = [];
		additions = [];
	};

	for (const [index, { type, content }] of lines.entries()) {
		if (type === "unchanged") closeRun();
		else (type === "removed" ? removals : additions).push({ index, content });
	}
	closeRun();

	return ranges;
}

function markPair(
	removal: ChangedLine,
	addition: ChangedLine,
	ranges: Map<number, TextRange>,
): void {
	const change = inlineChange(removal.content, addition.content);
	if (!change) return;
	recordRange(ranges, removal.index, change.removed);
	recordRange(ranges, addition.index, change.added);
}

function recordRange(
	ranges: Map<number, TextRange>,
	index: number,
	range: TextRange,
): void {
	if (range.start < range.end) ranges.set(index, range);
}

function isBlank(text: string): boolean {
	return text.trim() === "";
}

function commonPrefixLength(a: string, b: string): number {
	const limit = Math.min(a.length, b.length);
	let length = 0;
	while (length < limit && a[length] === b[length]) length++;
	return endsOnHighSurrogate(a, length) ? length - 1 : length;
}

function endsOnHighSurrogate(text: string, length: number): boolean {
	return length > 0 && isHighSurrogate(text.charCodeAt(length - 1));
}

function isHighSurrogate(code: number): boolean {
	return code >= 0xd800 && code <= 0xdbff;
}

function commonSuffixLength(a: string, b: string, prefix: number): number {
	const limit = Math.min(a.length, b.length) - prefix;
	let length = 0;
	while (
		length < limit &&
		a[a.length - 1 - length] === b[b.length - 1 - length]
	) {
		length++;
	}
	return startsOnLowSurrogate(a, a.length - length) ? length - 1 : length;
}

function startsOnLowSurrogate(text: string, start: number): boolean {
	return start < text.length && isLowSurrogate(text.charCodeAt(start));
}

function isLowSurrogate(code: number): boolean {
	return code >= 0xdc00 && code <= 0xdfff;
}
