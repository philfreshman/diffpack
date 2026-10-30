import type { CSSProperties } from "react";
import { IconButton } from "#/components/ui/IconButton/IconButton.tsx";
import {
	ChevronDownIcon,
	FileIcon,
	FoldIcon,
	UnfoldIcon,
} from "#/components/ui/icons.tsx";
import { diffStat, type StatBlock } from "#/lib/review/fileStream.ts";
import type { DiffFileEntry, DiffStatus } from "#/lib/worker/protocol.ts";
import styles from "./FileHeader.module.css";

const LINE_COUNT = new Intl.NumberFormat("en-US");

const STATUS_LABELS: Record<DiffStatus, string> = {
	added: "Added",
	removed: "Removed",
	modified: "Modified",
	renamed: "Renamed",
	unchanged: "Unchanged",
};

const STAT_KINDS: readonly StatBlock[] = ["added", "removed", "neutral"];

interface FileHeaderProps {
	entry: DiffFileEntry;
	open: boolean;
	onOpenChange(open: boolean): void;
	viewed: boolean;
	onViewedChange(viewed: boolean): void;
	onOpenFile(): void;
	expandAll: boolean | null;
	onExpandAllChange(expandAll: boolean): void;
}

export function FileHeader({
	entry,
	open,
	onOpenChange,
	viewed,
	onViewedChange,
	onOpenFile,
	expandAll,
	onExpandAllChange,
}: FileHeaderProps) {
	const toggleLabel = open ? "Collapse file" : "Expand file";
	const foldLabel = expandAll ? "Fold all lines" : "Expand all lines";

	return (
		<header className={styles.header}>
			<IconButton
				aria-expanded={open}
				aria-label={toggleLabel}
				className={styles.chevron}
				data-testid="collapse-file"
				onClick={() => onOpenChange(!open)}
				title={toggleLabel}
			>
				<ChevronDownIcon height="16" width="16" />
			</IconButton>
			<span className={styles.status} data-status={entry.status}>
				{STATUS_LABELS[entry.status]}
			</span>
			<FilePath entry={entry} />
			<LineCounts added={entry.added ?? 0} removed={entry.removed ?? 0} />
			<div className={styles.actions}>
				<IconButton
					aria-label={foldLabel}
					aria-pressed={expandAll ?? false}
					className={styles.action}
					disabled={expandAll === null}
					onClick={() => onExpandAllChange(!expandAll)}
					title={foldLabel}
				>
					{expandAll ? (
						<FoldIcon height="16" width="16" />
					) : (
						<UnfoldIcon height="16" width="16" />
					)}
				</IconButton>
				<IconButton
					aria-label="Open file"
					className={styles.action}
					data-testid="open-file"
					onClick={onOpenFile}
					title="Open this file on its own"
				>
					<FileIcon height="16" width="16" />
				</IconButton>
				<label className={styles.viewed} data-checked={viewed ? "" : undefined}>
					<input
						checked={viewed}
						className={styles.checkbox}
						data-testid="viewed-toggle"
						onChange={(event) => {
							releasePointerFocus(event.currentTarget);
							onViewedChange(event.currentTarget.checked);
						}}
						type="checkbox"
					/>
					Viewed
				</label>
			</div>
		</header>
	);
}

function FilePath({ entry }: { entry: DiffFileEntry }) {
	const { directory, name } = splitPath(entry.path);
	const renamedFrom = entry.status === "renamed" ? entry.oldPath : undefined;

	return (
		<h3 className={styles.path} title={describePath(entry.path, renamedFrom)}>
			<span className={styles.directory}>
				<bdi>
					{renamedFrom && (
						<>
							<span className={styles.oldPath}>{renamedFrom}</span>
							<span className={styles.arrow}> → </span>
						</>
					)}
					{directory}
				</bdi>
			</span>
			<span className={styles.name}>{name}</span>
		</h3>
	);
}

function LineCounts({ added, removed }: { added: number; removed: number }) {
	const blocks = diffStat(added, removed);

	return (
		<span
			className={styles.counts}
			title={`${LINE_COUNT.format(added)} added, ${LINE_COUNT.format(removed)} removed`}
		>
			<span className={styles.added}>+{LINE_COUNT.format(added)}</span>
			<span className={styles.removed}>−{LINE_COUNT.format(removed)}</span>
			<span aria-hidden="true" className={styles.stat}>
				{STAT_KINDS.map((kind) => ({ kind, count: countOf(blocks, kind) }))
					.filter(({ count }) => count > 0)
					.map(({ kind, count }) => (
						<span
							className={styles.blocks}
							data-kind={kind}
							key={kind}
							style={{ "--blocks": count } as CSSProperties}
						/>
					))}
			</span>
		</span>
	);
}

function releasePointerFocus(input: HTMLInputElement): void {
	if (!input.matches(":focus-visible")) input.blur();
}

function countOf(blocks: readonly StatBlock[], kind: StatBlock): number {
	return blocks.filter((block) => block === kind).length;
}

function splitPath(path: string): { directory: string; name: string } {
	const cut = path.lastIndexOf("/") + 1;

	return { directory: path.slice(0, cut), name: path.slice(cut) };
}

function describePath(path: string, renamedFrom: string | undefined): string {
	return renamedFrom ? `${renamedFrom} → ${path}` : path;
}
