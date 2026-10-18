import type { DiffFileEntry } from "#/lib/worker/protocol.ts";

export interface TreeRow {
	entry: DiffFileEntry;
	depth: number;
	expanded: boolean;
	hasChildren: boolean;
}

export function rowKey(entry: DiffFileEntry): string {
	return `${entry.type}:${entry.path}`;
}

export interface TreeView {
	filter: string;
	onlyModified: boolean;
	expandedKeys: ReadonlySet<string>;
	/** Outranks auto-expansion. */
	collapsedKeys: ReadonlySet<string>;
}

export function visibleRows(
	root: DiffFileEntry | null,
	view: TreeView,
): TreeRow[] {
	if (!root) return [];

	const rows: TreeRow[] = [];
	for (const child of root.children ?? [])
		collect(child, 0, withSoleRootOpen(root, view), rows);

	return rows;
}

function hasVisibleDescendant(entry: DiffFileEntry, view: TreeView): boolean {
	return (entry.children ?? []).some(
		(child) => isVisible(child, view) || hasVisibleDescendant(child, view),
	);
}

function isVisible(entry: DiffFileEntry, view: TreeView): boolean {
	// The whole path, not the name, so a matching folder brings its contents.
	const matchesFilter = entry.path
		.toLowerCase()
		.includes(view.filter.toLowerCase());
	const changed = entry.status !== "unchanged";

	return matchesFilter && (!view.onlyModified || changed);
}

// A sole top-level folder opens by itself; only shutting it by hand overrides that.
function withSoleRootOpen(root: DiffFileEntry, view: TreeView): TreeView {
	const children = root.children ?? [];
	const sole = children.length === 1 ? children[0] : undefined;
	if (sole?.type !== "directory") return view;
	if (view.collapsedKeys.has(sole.path)) return view;

	return { ...view, expandedKeys: new Set([...view.expandedKeys, sole.path]) };
}

function collect(
	entry: DiffFileEntry,
	depth: number,
	view: TreeView,
	rows: TreeRow[],
): void {
	if (!isVisible(entry, view) && !hasVisibleDescendant(entry, view)) return;

	const children = entry.children ?? [];
	const hasChildren = children.length > 0;
	// While narrowed, folders on the way to a match open themselves.
	const narrowed = view.filter.length > 0 || view.onlyModified;
	const expanded =
		hasChildren &&
		(view.expandedKeys.has(entry.path) ||
			(narrowed &&
				!view.collapsedKeys.has(entry.path) &&
				hasVisibleDescendant(entry, view)));

	rows.push({ entry, depth, expanded, hasChildren });
	if (!expanded) return;

	for (const child of children) collect(child, depth + 1, view, rows);
}
