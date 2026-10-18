import type { DiffView, Expander } from "#/lib/diff/computeVisibility.ts";

export interface FileView extends DiffView {
	scrollTop: number;
}

const CLOSED: FileView = {
	expanded: new Set<number>(),
	expandAll: false,
	scrollTop: 0,
};

export type ViewMemory = ReadonlyMap<string, FileView>;

export function emptyMemory(): ViewMemory {
	return new Map();
}

export function fileView(memory: ViewMemory, path: string): FileView {
	return memory.get(path) ?? CLOSED;
}

export function withRevealed(
	memory: ViewMemory,
	path: string,
	expander: Expander,
): ViewMemory {
	const view = fileView(memory, path);
	const expanded = new Set(view.expanded);
	for (let index = expander.start; index <= expander.end; index++) {
		expanded.add(index);
	}

	return withView(memory, path, { ...view, expanded });
}

function withView(
	memory: ViewMemory,
	path: string,
	view: FileView,
): ViewMemory {
	return new Map(memory).set(path, view);
}

// Folding all also drops the lines opened by hand.
export function withExpandAll(
	memory: ViewMemory,
	path: string,
	expandAll: boolean,
): ViewMemory {
	const view = fileView(memory, path);

	return withView(memory, path, {
		...view,
		expandAll,
		expanded: expandAll ? view.expanded : CLOSED.expanded,
	});
}

export function withScrollTop(
	memory: ViewMemory,
	path: string,
	scrollTop: number,
): ViewMemory {
	return withView(memory, path, { ...fileView(memory, path), scrollTop });
}
