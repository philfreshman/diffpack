import { useRef } from "react";
import { useSetting } from "#/components/storage/useSetting.ts";
import { FileTree } from "#/components/tree/FileTree/FileTree.tsx";
import { TreeFilter } from "#/components/tree/TreeFilter/TreeFilter.tsx";
import { TreeMenu } from "#/components/tree/TreeMenu/TreeMenu.tsx";
import { ChevronLeftIcon } from "#/components/ui/icons.tsx";
import { TREE_LINE_COUNTS, TREE_WIDTH } from "#/lib/storage/settings.ts";
import { sidebar } from "#/lib/tree/sidebar.ts";
import type { DiffFileEntry } from "#/lib/worker/protocol.ts";
import styles from "./TreePanel.module.css";
import { usePanelPosition } from "./usePanelPosition.ts";
import { usePanelResize } from "./usePanelResize.ts";
import { useTreeRows } from "./useTreeRows.ts";

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
	const {
		rows,
		filter,
		changeFilter,
		onlyModified,
		changeOnlyModified,
		hideViewed,
		setHideViewed,
		toggleFolder,
	} = useTreeRows(tree, comparison, viewedPaths);
	const { value: lineCounts, set: setLineCounts } =
		useSetting(TREE_LINE_COUNTS);

	const panelRef = useRef<HTMLElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const { width, startResize, nudge } = usePanelResize(panelRef, contentRef);
	const position = usePanelPosition();

	return (
		<aside className={styles.panel} ref={panelRef} data-testid="tree-panel">
			<div className={styles.content} ref={contentRef}>
				<div className={styles.filter}>
					<TreeFilter filter={filter} onFilterChange={changeFilter} />
					<TreeMenu
						onlyModified={onlyModified}
						onOnlyModifiedChange={changeOnlyModified}
						lineCounts={lineCounts}
						onLineCountsChange={setLineCounts}
						hideViewed={hideViewed}
						onHideViewedChange={setHideViewed}
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
			<PanelEdge width={width} onResizeStart={startResize} onNudge={nudge} />
		</aside>
	);
}

interface PanelEdgeProps {
	width: number;
	onResizeStart(event: React.PointerEvent<HTMLElement>): void;
	onNudge(event: React.KeyboardEvent<HTMLElement>): void;
}

function PanelEdge({ width, onResizeStart, onNudge }: PanelEdgeProps) {
	return (
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
				onPointerDown={onResizeStart}
				onKeyDown={onNudge}
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
	);
}
