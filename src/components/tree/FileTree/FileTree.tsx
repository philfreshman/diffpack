import { type RefObject, useRef, useState } from "react";
import {
	CheckIcon,
	ChevronDownIcon,
	ChevronRightIcon,
	FileAddedIcon,
	FileDiffIcon,
	FileIcon,
	FileRemovedIcon,
	FolderIcon,
	FolderOpenIcon,
} from "#/components/ui/icons.tsx";
import { treeCommand } from "#/lib/tree/keymap.ts";
import { rowKey, type TreeRow } from "#/lib/tree/visibility.ts";
import type { DiffStatus } from "#/lib/worker/protocol.ts";
import styles from "./FileTree.module.css";

export interface FileTreeProps {
	rows: readonly TreeRow[];
	selectedPath: string;
	viewedPaths?: ReadonlySet<string>;
	onOpenFile(path: string): void;
	onToggleFolder(path: string, expanded: boolean): void;
}

const NONE_VIEWED: ReadonlySet<string> = new Set();

function nameOf(path: string): string {
	return path.split("/").pop() || path;
}

export function FileTree({
	rows,
	selectedPath,
	viewedPaths = NONE_VIEWED,
	onOpenFile,
	onToggleFolder,
}: FileTreeProps) {
	// By key, not index: filtering and expanding renumber the rows.
	const [focusedKey, setFocusedKey] = useState("");
	const elements = useRef(new Map<string, HTMLElement>());

	const index = rows.findIndex((row) => rowKey(row.entry) === focusedKey);
	const selectedIndex = rows.findIndex((row) => isSelected(row, selectedPath));
	const activeIndex = index >= 0 ? index : Math.max(selectedIndex, 0);
	const activeRow = rows[activeIndex];
	const activeKey = activeRow ? rowKey(activeRow.entry) : "";

	function focusRow(row: TreeRow) {
		setFocusedKey(rowKey(row.entry));
		const element = elements.current.get(rowKey(row.entry));
		element?.focus({ preventScroll: true });
		element?.scrollIntoView({ block: "nearest" });
	}

	function activate(row: TreeRow) {
		setFocusedKey(rowKey(row.entry));
		if (row.hasChildren) onToggleFolder(row.entry.path, !row.expanded);
		else onOpenFile(row.entry.path);
	}

	function handleKeyDown(event: React.KeyboardEvent) {
		const command = treeCommand(event.key, rows, activeIndex);
		const row = command && rows[command.index];
		if (!command || !row) return;

		if (command.kind === "focus") focusRow(row);
		else if (command.kind === "activate") activate(row);
		else onToggleFolder(row.entry.path, command.expanded);

		event.preventDefault();
	}

	return (
		// oxlint-disable-next-line jsx-a11y/interactive-supports-focus -- focus moves between the treeitems, which carry the tabindex
		<div
			className={styles.tree}
			role="tree"
			aria-label="Changed files"
			onKeyDown={handleKeyDown}
		>
			{rows.map((row) => (
				<FileTreeRow
					active={rowKey(row.entry) === activeKey}
					key={rowKey(row.entry)}
					onActivate={activate}
					onFocus={setFocusedKey}
					register={elements}
					row={row}
					selected={isSelected(row, selectedPath)}
					viewed={isViewed(row, viewedPaths)}
				/>
			))}
		</div>
	);
}

function isSelected(row: TreeRow, selectedPath: string): boolean {
	return row.entry.type === "file" && row.entry.path === selectedPath;
}

function isViewed(row: TreeRow, viewedPaths: ReadonlySet<string>): boolean {
	return row.entry.type === "file" && viewedPaths.has(row.entry.path);
}

interface FileTreeRowProps {
	row: TreeRow;
	active: boolean;
	selected: boolean;
	viewed: boolean;
	onActivate(row: TreeRow): void;
	onFocus(key: string): void;
	register: RefObject<Map<string, HTMLElement>>;
}
function FileTreeRow({
	row,
	active,
	selected,
	viewed,
	onActivate,
	onFocus,
	register,
}: FileTreeRowProps) {
	const { entry, expanded, hasChildren } = row;
	const key = rowKey(entry);

	return (
		// oxlint-disable-next-line jsx-a11y/click-events-have-key-events -- the tree owns the keyboard, per the ARIA practices guide
		<div
			role="treeitem"
			className={styles.row}
			ref={(element) => {
				if (element) register.current.set(key, element);
				else register.current.delete(key);
			}}
			tabIndex={active ? 0 : -1}
			onFocus={() => onFocus(key)}
			style={{ paddingLeft: `${row.depth * 18 + 4}px` }}
			aria-level={row.depth + 1}
			aria-expanded={hasChildren ? expanded : undefined}
			aria-selected={selected}
			data-path={entry.path}
			data-type={entry.type}
			data-status={entry.status}
			data-viewed={viewed || undefined}
			title={
				entry.status === "renamed" && entry.oldPath
					? `Renamed from ${entry.oldPath}`
					: entry.path
			}
			onClick={() => onActivate(row)}
		>
			<RowChevron expanded={expanded} hasChildren={hasChildren} />
			<RowIcon
				expanded={expanded}
				folder={entry.type === "directory"}
				status={entry.status}
			/>
			<span className={styles.name} data-testid="name">
				{nameOf(entry.path)}
			</span>
			{viewed && (
				<span
					className={styles.viewed}
					role="img"
					aria-label="Viewed"
					title="Viewed"
					data-testid="viewed-mark"
				>
					<CheckIcon width="12" height="12" />
				</span>
			)}
			{entry.added ? (
				<span className={styles.added} data-testid="added">
					+{entry.added}
				</span>
			) : null}
			{entry.removed ? (
				<span className={styles.removed} data-testid="removed">
					-{entry.removed}
				</span>
			) : null}
		</div>
	);
}

function RowChevron({
	expanded,
	hasChildren,
}: {
	expanded: boolean;
	hasChildren: boolean;
}) {
	return (
		<span className={styles.slot}>
			{hasChildren ? (
				<span data-testid="chevron" data-expanded={expanded}>
					{expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
				</span>
			) : null}
		</span>
	);
}

const GLYPHS = {
	file: FileIcon,
	"file-added": FileAddedIcon,
	"file-removed": FileRemovedIcon,
	"file-diff": FileDiffIcon,
	folder: FolderIcon,
	"folder-open": FolderOpenIcon,
};

type GlyphName = keyof typeof GLYPHS;

const FILE_GLYPHS: Record<DiffStatus, GlyphName> = {
	added: "file-added",
	removed: "file-removed",
	modified: "file-diff",
	renamed: "file-diff",
	unchanged: "file",
};

const STATUS_LABELS: Record<DiffStatus, string | undefined> = {
	added: "Added",
	removed: "Removed",
	modified: "Modified",
	renamed: "Renamed",
	unchanged: undefined,
};

function glyphNameOf(
	folder: boolean,
	expanded: boolean,
	status: DiffStatus,
): GlyphName {
	if (folder) return expanded ? "folder-open" : "folder";
	return FILE_GLYPHS[status];
}

function RowIcon({
	expanded,
	folder,
	status,
}: {
	expanded: boolean;
	folder: boolean;
	status: DiffStatus;
}) {
	const name = glyphNameOf(folder, expanded, status);
	const Glyph = GLYPHS[name];
	const label = folder ? undefined : STATUS_LABELS[status];

	return (
		<span
			className={folder ? styles.folderIcon : styles.fileIcon}
			role={label && "img"}
			aria-label={label}
			title={label}
			data-testid="icon"
			data-icon={name}
			data-status={folder ? undefined : status}
		>
			<Glyph />
		</span>
	);
}
