import type { ReactNode } from "react";
import { useMemo, useReducer, useRef, useState } from "react";
import { useSetting } from "#/components/storage/useSetting.ts";
import { FileTree } from "#/components/tree/FileTree/FileTree.tsx";
import { TreeFilter } from "#/components/tree/TreeFilter/TreeFilter.tsx";
import { TreeMenu } from "#/components/tree/TreeMenu/TreeMenu.tsx";
import { ChevronLeftIcon } from "#/components/ui/icons.tsx";
import { ONLY_MODIFIED, TREE_WIDTH } from "#/lib/storage/settings.ts";
import { folderReducer, foldersFor } from "#/lib/tree/folders.ts";
import { sidebar } from "#/lib/tree/sidebar.ts";
import { visibleRows } from "#/lib/tree/visibility.ts";
import type { DiffFileEntry } from "#/lib/worker/protocol.ts";
import styles from "./TreePanel.module.css";
import { usePanelResize } from "./usePanelResize.ts";

export interface TreePanelProps {
	tree: DiffFileEntry | null;
	comparison: string;
	selectedPath: string;
	onOpenFile(path: string): void;
	header?: ReactNode;
}
export function TreePanel({
	tree,
	comparison,
	selectedPath,
	onOpenFile,
	header,
}: TreePanelProps) {
	const [filter, setFilter] = useState("");
	const { value: onlyModified, set: setOnlyModified } =
		useSetting(ONLY_MODIFIED);

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

	return (
		<aside className={styles.panel} ref={panelRef} data-testid="tree-panel">
			<div className={styles.content} ref={contentRef}>
				{header && <div className={styles.head}>{header}</div>}
				<div className={styles.filter}>
					<TreeFilter
						filter={filter}
						onFilterChange={(next) => narrow(() => setFilter(next))}
					/>
					<TreeMenu
						onlyModified={onlyModified}
						onOnlyModifiedChange={(next) => narrow(() => setOnlyModified(next))}
					/>
				</div>
				<FileTree
					rows={rows}
					selectedPath={selectedPath}
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
					<ChevronLeftIcon width="14" height="14" />
				</button>
			</div>
		</aside>
	);
}
