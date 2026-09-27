import { SettingsMenu } from "#/components/diff/SettingsMenu/SettingsMenu.tsx";
import type { FileModelControls } from "#/components/diff/useFileModel.ts";
import type { HighlightThemeControls } from "#/components/diff/useHighlightTheme.ts";
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
	/** The file being read, or `""` when the comparison has none open. */
	path: string;
	/** Where that file sits in the changed files, and how many there are. */
	fileIndex: number;
	fileCount: number;
	/** The next changed file up (`-1`) or down (`1`) the tree. */
	onStepFile(direction: 1 | -1): void;
	/** Back to the comparison, with no file open. */
	onClose(): void;
	/**
	 * The file on screen, read from the same model the viewer draws: how many
	 * differences it has and how to step through them, and whether it is all
	 * open. `null` while there is no file on screen to read.
	 */
	file: Pick<
		FileModelControls,
		"differences" | "stepDifference" | "expandAll" | "setExpandAll"
	> | null;
	/** The old file beside the new one, rather than one after the other. */
	split: boolean;
	onSplitChange(split: boolean): void;
	/** Whether a line that differs only in whitespace counts as a change. */
	ignoreWhitespace: boolean;
	onIgnoreWhitespaceChange(ignore: boolean): void;
	/** Which theme the code is coloured with — the gear's longest setting. */
	highlight: HighlightThemeControls;
}

/**
 * The bar above the viewer: on the left, where the reader is and how they move
 * — through the differences in this file, then through the files themselves;
 * on the right, how what they are reading is shown.
 *
 * It is part of the workspace's frame rather than the file's, so it stands
 * whether or not a file is open (a comparison with nothing chosen still shows
 * it, with its navigation stood down) — the layout does not rearrange itself
 * under the reader on every click.
 *
 * Expand-all is the file's state, not the toolbar's — the file model remembers
 * it per file (task 12), so the button reports what the file it is over is
 * doing rather than keeping a count of its own clicks.
 */
export function DiffToolbar({
	path,
	fileIndex,
	fileCount,
	onStepFile,
	onClose,
	file,
	split,
	onSplitChange,
	ignoreWhitespace,
	onIgnoreWhitespaceChange,
	highlight,
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
				{/* The position is stated even with nothing open, so the count of
				    files to read is on screen before the first click. */}
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

			<SettingsMenu
				highlight={highlight}
				ignoreWhitespace={ignoreWhitespace}
				onIgnoreWhitespaceChange={onIgnoreWhitespaceChange}
			/>
		</div>
	);
}

/**
 * The right-hand half: how what is being read is shown, rather than where in
 * it the reader is. Expand-all needs a file to work on; the two layouts do
 * not, and stay live so the choice can be made before one is opened.
 */
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
			{/* Two buttons rather than one that swaps: which layout is showing is
			    then readable without working out what the icon would do next. */}
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
