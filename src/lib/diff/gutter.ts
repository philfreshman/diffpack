import type { DiffLine } from "#/lib/diff/parseUnifiedDiff.ts";

const MIN_DIGITS = 3;

// Measured over the whole file, not the rendered rows: the list is
// virtualised, so the gutter would shift width while scrolling.
export function gutterChars(lines: DiffLine[]): number {
	let highest = 0;
	for (const line of lines) {
		highest = Math.max(highest, line.oldNumber ?? 0, line.newNumber ?? 0);
	}

	return Math.max(String(highest).length, MIN_DIGITS);
}
