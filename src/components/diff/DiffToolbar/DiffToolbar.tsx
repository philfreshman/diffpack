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
	CloseIcon,
	FoldIcon,
	SplitViewIcon,
	UnfoldIcon,
	UnifiedViewIcon,
} from "#/components/ui/icons.tsx";
import styles from "./DiffToolbar.module.css";

export interface DiffToolbarProps {
	/** `""` when no file is open. */
	path: string;
	fileIndex: number;
	fileCount: number;
	onStepFile(direction: 1 | -1): void;
	onClose(): void;
	file: Pick<
		FileModelControls,
		"differences" | "stepDifference" | "expandAll" | "setExpandAll"
	> | null;
	split: boolean;
	onSplitChange(split: boolean): void;
	settings: SettingsMenuProps;
}

export function DiffToolbar({
	path,
	fileIndex,
	fileCount,
	onStepFile,
	onClose,
	file,
	split,
	onSplitChange,
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
				<IconButton
					aria-label="Close file"
					title="Close file"
					disabled={!open}
					onClick={onClose}
				>
					<CloseIcon width="16" height="16" />
				</IconButton>
			</div>

			<h2 className={styles.filename}>{path}</h2>

			{file && (
				<span className={styles.differences} data-testid="difference-count">
					{file.differences}{" "}
					{file.differences === 1 ? "difference" : "differences"}
				</span>
			)}

			<ViewControls file={file} onSplitChange={onSplitChange} split={split} />

			<SettingsMenu {...settings} />
		</div>
	);
}

function ViewControls({
	file,
	split,
	onSplitChange,
}: Pick<DiffToolbarProps, "file" | "split" | "onSplitChange">) {
	const expandAll = file?.expandAll ?? false;
	const fold = expandAll ? "Fold all" : "Expand all";

	return (
		<div className={styles.group}>
			<IconButton
				aria-label={fold}
				aria-pressed={expandAll}
				title={fold}
				disabled={!file}
				onClick={() => file?.setExpandAll(!expandAll)}
			>
				{expandAll ? (
					<FoldIcon width="16" height="16" />
				) : (
					<UnfoldIcon width="16" height="16" />
				)}
			</IconButton>
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
