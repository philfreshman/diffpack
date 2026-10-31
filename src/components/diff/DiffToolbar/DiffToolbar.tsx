import {
	SettingsMenu,
	type SettingsMenuProps,
} from "#/components/diff/SettingsMenu/SettingsMenu.tsx";
import type { FileModelControls } from "#/components/diff/useFileModel.ts";
import { IconButton } from "#/components/ui/IconButton/IconButton.tsx";
import {
	ArrowDownIcon,
	ArrowLeftIcon,
	ArrowRightIcon,
	ArrowUpIcon,
	FileIcon,
	FilesIcon,
	SplitViewIcon,
	UnifiedViewIcon,
} from "#/components/ui/icons.tsx";
import type { FileLayout } from "#/lib/review/fileStream.ts";
import styles from "./DiffToolbar.module.css";

export interface DiffToolbarProps {
	/** `""` when no file is open. */
	path: string;
	fileIndex: number;
	fileCount: number;
	onStepFile(direction: 1 | -1): void;
	file: Pick<FileModelControls, "stepDifference"> | null;
	split: boolean;
	onSplitChange(split: boolean): void;
	layout: FileLayout;
	onLayoutChange(layout: FileLayout): void;
	settings: SettingsMenuProps;
}

export function DiffToolbar({
	path,
	fileIndex,
	fileCount,
	onStepFile,
	file,
	split,
	onSplitChange,
	layout,
	onLayoutChange,
	settings,
}: DiffToolbarProps) {
	const open = path !== "";

	return (
		<div className={styles.toolbar} data-testid="diff-toolbar">
			<div className={styles.group}>
				<IconButton
					aria-label="Previous difference"
					title="Previous difference"
					disabled={!file}
					onClick={() => file?.stepDifference(-1)}
				>
					<ArrowUpIcon width="16" height="16" />
				</IconButton>
				<IconButton
					aria-label="Next difference"
					title="Next difference"
					disabled={!file}
					onClick={() => file?.stepDifference(1)}
				>
					<ArrowDownIcon width="16" height="16" />
				</IconButton>
			</div>

			<div className={styles.group}>
				<IconButton
					aria-label="Previous file"
					title="Previous file"
					disabled={fileIndex <= 0}
					onClick={() => onStepFile(-1)}
				>
					<ArrowLeftIcon width="16" height="16" />
				</IconButton>
				<span className={styles.counter} data-testid="file-counter">
					{open ? `${fileIndex + 1}/${fileCount}` : fileCount} files
				</span>
				<IconButton
					aria-label="Next file"
					title="Next file"
					disabled={fileIndex < 0 || fileIndex >= fileCount - 1}
					onClick={() => onStepFile(1)}
				>
					<ArrowRightIcon width="16" height="16" />
				</IconButton>
			</div>

			<span className={styles.spacer} />

			<ViewControls onSplitChange={onSplitChange} split={split} />

			<LayoutControls layout={layout} onLayoutChange={onLayoutChange} />

			<SettingsMenu {...settings} />
		</div>
	);
}

function ViewControls({
	split,
	onSplitChange,
}: Pick<DiffToolbarProps, "split" | "onSplitChange">) {
	return (
		<div className={styles.group}>
			<IconButton
				aria-label="Switch to split view"
				aria-pressed={split}
				title="Switch to split view"
				onClick={() => onSplitChange(true)}
			>
				<SplitViewIcon width="16" height="16" />
			</IconButton>
			<IconButton
				aria-label="Switch to unified view"
				aria-pressed={!split}
				title="Switch to unified view"
				onClick={() => onSplitChange(false)}
			>
				<UnifiedViewIcon width="16" height="16" />
			</IconButton>
		</div>
	);
}

function LayoutControls({
	layout,
	onLayoutChange,
}: Pick<DiffToolbarProps, "layout" | "onLayoutChange">) {
	return (
		<div className={styles.group}>
			<IconButton
				aria-label="Show one file at a time"
				aria-pressed={layout === "single"}
				title="Show one file at a time"
				data-testid="layout-single"
				onClick={() => onLayoutChange("single")}
			>
				<FileIcon width="16" height="16" />
			</IconButton>
			<IconButton
				aria-label="Show all files"
				aria-pressed={layout === "all"}
				title="Show all files"
				data-testid="layout-all"
				onClick={() => onLayoutChange("all")}
			>
				<FilesIcon width="16" height="16" />
			</IconButton>
		</div>
	);
}
