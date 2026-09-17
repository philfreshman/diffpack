import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileTree } from "#/components/tree/FileTree/FileTree.tsx";
import { TreeFilter } from "#/components/tree/TreeFilter/TreeFilter.tsx";
import { ChevronLeftIcon } from "#/components/ui/icons.tsx";
import {
	MAX_TREE_WIDTH,
	MIN_TREE_WIDTH,
	readOnlyModified,
	toggleTreeCollapsed,
	writeOnlyModified,
} from "#/lib/tree/prefs.ts";
import { visibleRows } from "#/lib/tree/visibility.ts";
import type { DiffFileEntry } from "#/lib/worker/protocol.ts";
import styles from "./TreePanel.module.css";
import { usePanelResize } from "./usePanelResize.ts";

const EMPTY: ReadonlySet<string> = new Set();

export interface TreePanelProps {
	tree: DiffFileEntry | null;
	selectedPath: string;
	onOpenFile(path: string): void;
	/** What stands over the panel: where a dashboard keeps its team switcher. */
	header?: ReactNode;
	/**
	 * What the tree amounts to, stated at its foot — the count belongs to the
	 * list it counts, so it sits under it rather than over the whole body.
	 */
	footer?: ReactNode;
}

/**
 * The sidebar: how the comparison is navigated, full height down the left of
 * the window the way a dashboard keeps its navigation. It owns what the tree
 * shows — the filter, only-modified, and which folders the user has opened or
 * closed by hand — and hands `visibleRows` the whole of that state at once.
 */
export function TreePanel({
	tree,
	selectedPath,
	onOpenFile,
	header,
	footer,
}: TreePanelProps) {
	const [filter, setFilter] = useState("");
	// A stored preference cannot be read during render — the server has no
	// `localStorage`, and reading it in the first client render is the same
	// mismatch. The default is what SSR shows; the effect corrects it.
	const [onlyModified, setOnlyModified] = useState(true);
	useEffect(() => setOnlyModified(readOnlyModified()), []);

	const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(
		() => new Set(),
	);
	const [collapsedKeys, setCollapsedKeys] = useState<ReadonlySet<string>>(
		() => new Set(),
	);

	const rows = useMemo(
		() =>
			visibleRows(tree, { filter, onlyModified, expandedKeys, collapsedKeys }),
		[tree, filter, onlyModified, expandedKeys, collapsedKeys],
	);

	/** Opening or closing a folder is a choice, and it outranks auto-expansion. */
	function toggleFolder(path: string, expanded: boolean) {
		setExpandedKeys((keys) => withKey(keys, path, expanded));
		setCollapsedKeys((keys) => withKey(keys, path, !expanded));
	}

	/**
	 * Narrowing the tree clears the folders closed by hand: they were closed
	 * against a fuller tree, and holding them shut would hide the very rows the
	 * user just asked to see.
	 */
	function narrow(change: () => void) {
		setCollapsedKeys(EMPTY);
		change();
	}

	const panelRef = useRef<HTMLElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const { width, startResize, nudge } = usePanelResize(panelRef, contentRef);

	return (
		<aside className={styles.panel} ref={panelRef} data-testid="tree-panel">
			{/* Held at the panel's minimum and pinned to its right edge, so a drag
			    past the minimum slides it out of the window instead of crushing it. */}
			<div className={styles.content} ref={contentRef}>
				{header && <div className={styles.head}>{header}</div>}
				<TreeFilter
					filter={filter}
					onFilterChange={(next) => narrow(() => setFilter(next))}
					onlyModified={onlyModified}
					onOnlyModifiedChange={(next) =>
						narrow(() => {
							setOnlyModified(next);
							writeOnlyModified(next);
						})
					}
				/>
				<FileTree
					rows={rows}
					selectedPath={selectedPath}
					onOpenFile={onOpenFile}
					onToggleFolder={toggleFolder}
				/>
				{footer && <div className={styles.foot}>{footer}</div>}
			</div>
			{/* The edge is a grip and, on hover, the way to shut the panel: the
			    button sits across the rule rather than inside the panel, so it
			    takes nothing from the tree's width. */}
			<div className={styles.edge}>
				{/* biome-ignore lint/a11y/useSemanticElements: an <hr> cannot be dragged */}
				<div
					className={styles.resizer}
					role="separator"
					aria-label="Resize file tree"
					aria-orientation="vertical"
					aria-valuenow={width}
					aria-valuemin={MIN_TREE_WIDTH}
					aria-valuemax={MAX_TREE_WIDTH}
					tabIndex={0}
					onPointerDown={startResize}
					onKeyDown={nudge}
				/>
				<button
					type="button"
					className={styles.collapse}
					aria-label="Collapse sidebar"
					title="Collapse sidebar"
					onClick={() => toggleTreeCollapsed(document)}
				>
					<ChevronLeftIcon width="14" height="14" />
				</button>
			</div>
		</aside>
	);
}

function withKey(
	keys: ReadonlySet<string>,
	path: string,
	present: boolean,
): ReadonlySet<string> {
	const next = new Set(keys);
	if (present) next.add(path);
	else next.delete(path);

	return next;
}
