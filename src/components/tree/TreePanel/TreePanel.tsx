import { useMemo, useReducer, useRef, useState } from "react";
import { useSetting } from "#/components/storage/useSetting.ts";
import { FileTree } from "#/components/tree/FileTree/FileTree.tsx";
import { TreeFilter } from "#/components/tree/TreeFilter/TreeFilter.tsx";
import { TreeMenu } from "#/components/tree/TreeMenu/TreeMenu.tsx";
import { ChevronLeftIcon } from "#/components/ui/icons.tsx";
import {
	ONLY_MODIFIED,
	TREE_LINE_COUNTS,
	TREE_WIDTH,
} from "#/lib/storage/settings.ts";
import { folderReducer, foldersFor } from "#/lib/tree/folders.ts";
import { sidebar } from "#/lib/tree/sidebar.ts";
import { visibleRows } from "#/lib/tree/visibility.ts";
import type { DiffFileEntry } from "#/lib/worker/protocol.ts";
import styles from "./TreePanel.module.css";
import { usePanelPosition } from "./usePanelPosition.ts";
import { usePanelResize } from "./usePanelResize.ts";

export interface TreePanelProps {
	tree: DiffFileEntry | null;
	comparison: string;
	selectedPath: string;
	viewedPaths?: ReadonlySet<string>;
	onOpenFile(path: string): void;
}
export function TreePanel({
	tree,
	comparison,
	selectedPath,
	viewedPaths,
	onOpenFile,
}: TreePanelProps) {
	const [filter, setFilter] = useState("");
	const { value: onlyModified, set: setOnlyModified } =
		useSetting(ONLY_MODIFIED);
	const { value: lineCounts, set: setLineCounts } =
		useSetting(TREE_LINE_COUNTS);

	const [folders, dispatch] = useReducer(folderReducer, comparison, foldersFor);
	// Reset during render: an effect would render once with the old comparison's folders.
	if (folders.comparison !== comparison)
		dispatch({ kind: "reset", comparison });
	const { expandedKeys, collapsedKeys } = folders;

	const rows = useMemo(
		() =>
			visibleRows(tree, { filter, onlyModified, expandedKeys, collapsedKeys }),
		[tree, filter, onlyModified, expandedKeys, collapsedKeys],
	);

	function toggleFolder(path: string, expanded: boolean) {
		dispatch({ kind: "toggle", path, expanded });
	}

	function narrow(change: () => void) {
		dispatch({ kind: "narrow" });
		change();
	}

	const panelRef = useRef<HTMLElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const { width, startResize, nudge } = usePanelResize(panelRef, contentRef);
	const position = usePanelPosition();

	return (
		<aside className={styles.panel} ref={panelRef} data-testid="tree-panel">
			<div className={styles.content} ref={contentRef}>
				<div className={styles.filter}>
					<TreeFilter
						filter={filter}
						onFilterChange={(next) => narrow(() => setFilter(next))}
					/>
					<TreeMenu
						onlyModified={onlyModified}
						onOnlyModifiedChange={(next) => narrow(() => setOnlyModified(next))}
						lineCounts={lineCounts}
						onLineCountsChange={setLineCounts}
						position={position}
						onPositionChange={sidebar.place}
					/>
				</div>
				<FileTree
					rows={rows}
					selectedPath={selectedPath}
					viewedPaths={viewedPaths}
					lineCounts={lineCounts}
					onOpenFile={onOpenFile}
					onToggleFolder={toggleFolder}
				/>
			</div>
			<div className={styles.edge}>
				<div
					className={styles.resizer}
					role="separator"
					aria-label="Resize file tree"
					aria-orientation="vertical"
					aria-valuenow={width}
					aria-valuemin={TREE_WIDTH.min}
					aria-valuemax={TREE_WIDTH.max}
					tabIndex={0}
					onPointerDown={startResize}
					onKeyDown={nudge}
				/>
				<button
					type="button"
					className={styles.collapse}
					aria-label="Collapse sidebar"
					title="Collapse sidebar"
					onClick={() => sidebar.close()}
				>
					<ChevronLeftIcon className={styles.chevron} width="14" height="14" />
				</button>
			</div>
		</aside>
	);
}
