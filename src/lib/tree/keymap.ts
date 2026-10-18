import type { TreeRow } from "./visibility.ts";

export type TreeCommand =
	| { kind: "focus"; index: number }
	| { kind: "activate"; index: number }
	| { kind: "toggle"; index: number; expanded: boolean };

interface Cursor {
	rows: readonly TreeRow[];
	index: number;
	row: TreeRow;
}

// On a leaf or an empty open folder, does nothing rather than moving to the next sibling.
function stepIn({ rows, index, row }: Cursor): TreeCommand | undefined {
	if (row.hasChildren && !row.expanded) {
		return { kind: "toggle", index, expanded: true };
	}
	if ((rows[index + 1]?.depth ?? -1) > row.depth) {
		return { kind: "focus", index: index + 1 };
	}

	return undefined;
}

function stepOut({ rows, index, row }: Cursor): TreeCommand | undefined {
	if (row.hasChildren && row.expanded) {
		return { kind: "toggle", index, expanded: false };
	}
	for (let i = index - 1; i >= 0; i -= 1) {
		if ((rows[i]?.depth ?? 0) < row.depth) return { kind: "focus", index: i };
	}

	return undefined;
}

// The WAI-ARIA authoring practices' tree pattern.
const KEYS: Record<string, (cursor: Cursor) => TreeCommand | undefined> = {
	ArrowDown: ({ index }) => ({ kind: "focus", index: index + 1 }),
	ArrowUp: ({ index }) => ({ kind: "focus", index: index - 1 }),
	Home: () => ({ kind: "focus", index: 0 }),
	End: ({ rows }) => ({ kind: "focus", index: rows.length - 1 }),
	Enter: ({ index }) => ({ kind: "activate", index }),
	" ": ({ index }) => ({ kind: "activate", index }),
	ArrowRight: stepIn,
	ArrowLeft: stepOut,
};

// `undefined` means the key belongs to the page and must not be swallowed.
export function treeCommand(
	key: string,
	rows: readonly TreeRow[],
	index: number,
): TreeCommand | undefined {
	const row = rows[index];
	if (!row) return undefined;

	const command = KEYS[key]?.({ rows, index, row });
	if (command?.kind !== "focus") return command;

	return { ...command, index: clamp(command.index, rows.length) };
}

function clamp(index: number, length: number): number {
	return Math.min(Math.max(index, 0), length - 1);
}
