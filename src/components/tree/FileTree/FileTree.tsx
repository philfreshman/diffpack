import { useRef, useState } from "react";
import {
	ChevronDownIcon,
	ChevronRightIcon,
	FileIcon,
	FolderIcon,
	FolderOpenIcon,
} from "#/components/ui/icons.tsx";
import { treeCommand } from "#/lib/tree/keymap.ts";
import { rowKey, type TreeRow } from "#/lib/tree/visibility.ts";
import styles from "./FileTree.module.css";

export interface FileTreeProps {
	rows: readonly TreeRow[];
	selectedPath: string;
	onOpenFile(path: string): void;
	onToggleFolder(path: string, expanded: boolean): void;
}

function nameOf(path: string): string {
	return path.split("/").pop() || path;
}

const STAGGER_MS = 2;
const STAGGER_CAP = 30;
export function FileTree({
	rows,
	selectedPath,
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
		<div
			className={styles.tree}
			role="tree"
			aria-label="Changed files"
			onKeyDown={handleKeyDown}
		>
			{rows.map((row, position) => (
				<FileTreeRow
					active={rowKey(row.entry) === activeKey}
					key={rowKey(row.entry)}
					onActivate={activate}
					onFocus={setFocusedKey}
					position={position}
					register={elements.current}
					row={row}
					selected={isSelected(row, selectedPath)}
				/>
			))}
		</div>
	);
}

function isSelected(row: TreeRow, selectedPath: string): boolean {
	return row.entry.type === "file" && row.entry.path === selectedPath;
}

interface FileTreeRowProps {
	row: TreeRow;
	active: boolean;
	selected: boolean;
	onActivate(row: TreeRow): void;
	onFocus(key: string): void;
	/** Read only at mount, for the fade-in delay. */
	position: number;
	register: Map<string, HTMLElement>;
}
function FileTreeRow({
	row,
	active,
	selected,
	onActivate,
	onFocus,
	position,
	register,
}: FileTreeRowProps) {
	const { entry, expanded, hasChildren } = row;
	const key = rowKey(entry);
	// Pinned at mount: a later delay on a settled row would replay its animation.
	const [delay] = useState(() => Math.min(position, STAGGER_CAP) * STAGGER_MS);

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: the tree owns the keyboard, per the ARIA practices guide
		<div
			role="treeitem"
			className={styles.row}
			ref={(element) => {
				if (element) register.set(key, element);
				else register.delete(key);
			}}
			tabIndex={active ? 0 : -1}
			onFocus={() => onFocus(key)}
			style={{
				paddingLeft: `${row.depth * 18 + 4}px`,
				animationDelay: `${delay}ms`,
			}}
			aria-level={row.depth + 1}
			aria-expanded={hasChildren ? expanded : undefined}
			aria-selected={selected}
			data-path={entry.path}
			data-type={entry.type}
			data-status={entry.status}
			title={
				entry.status === "renamed" && entry.oldPath
					? `Renamed from ${entry.oldPath}`
					: entry.path
			}
			onClick={() => onActivate(row)}
		>
			<RowChevron expanded={expanded} hasChildren={hasChildren} />
			<RowIcon expanded={expanded} folder={entry.type === "directory"} />
			<span className={styles.name} data-testid="name">
				{nameOf(entry.path)}
			</span>
			{entry.status === "renamed" && (
				<span className={styles.renamed}>RENAMED</span>
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
	folder: FolderIcon,
	"folder-open": FolderOpenIcon,
};

function RowIcon({ expanded, folder }: { expanded: boolean; folder: boolean }) {
	const name = folder ? (expanded ? "folder-open" : "folder") : "file";
	const Glyph = GLYPHS[name];

	return (
		<span
			className={folder ? styles.folderIcon : styles.fileIcon}
			data-testid="icon"
			data-icon={name}
		>
			<Glyph />
		</span>
	);
}
