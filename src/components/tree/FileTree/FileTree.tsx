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
	/** The file the URL names, if it is in this comparison. */
	selectedPath: string;
	onOpenFile(path: string): void;
	onToggleFolder(path: string, expanded: boolean): void;
}

/** The name a row shows: the last segment of its path. */
function nameOf(path: string): string {
	return path.split("/").pop() || path;
}

/** How far each row's fade-in is behind the one above it. */
const STAGGER_MS = 2;
/**
 * Where the stagger stops. A comparison can bring thousands of rows and only
 * the first screenful is watched arriving; beyond that the cascade would be a
 * wait rather than an entrance, so the rest come in together at the end of it.
 */
const STAGGER_CAP = 30;

/**
 * The file tree, as a real `role="tree"`: rows carry their own depth and
 * expanded state, and the flat row list they come from is what the keyboard
 * walks.
 *
 * Which row a key lands on is `lib/tree/keymap.ts`'s answer, not this
 * component's — everything left here is the part that needs a DOM: moving
 * focus, and telling the workspace what was asked for.
 */
export function FileTree({
	rows,
	selectedPath,
	onOpenFile,
	onToggleFolder,
}: FileTreeProps) {
	// A tree is one tab stop: exactly one row is tabbable, and the arrows move
	// which one that is. The focused row is remembered by its key rather than
	// by index, because filtering and expanding renumber the rows underneath
	// it.
	const [focusedKey, setFocusedKey] = useState("");
	const elements = useRef(new Map<string, HTMLElement>());

	const index = rows.findIndex((row) => rowKey(row.entry) === focusedKey);
	const selectedIndex = rows.findIndex((row) => isSelected(row, selectedPath));
	// Nothing focused yet: the file the URL names is where the user already is,
	// and failing that the top of the tree.
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
		// A key the tree does not answer to is the page's; it is not swallowed.
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

/**
 * Whether `row` is the file the URL names. Only a file can be: a folder at the
 * same path is another row, and the URL never names a folder.
 */
function isSelected(row: TreeRow, selectedPath: string): boolean {
	return row.entry.type === "file" && row.entry.path === selectedPath;
}

interface FileTreeRowProps {
	row: TreeRow;
	/** Whether this is the tree's one tab stop. */
	active: boolean;
	/** Whether this is the file the URL names. */
	selected: boolean;
	onActivate(row: TreeRow): void;
	/** Says which row took focus, by its `rowKey`. */
	onFocus(key: string): void;
	/** How far down the tree this row sat when it appeared: its turn in the
	    fade-in, and read only then. */
	position: number;
	/** Where the rows put themselves, by `rowKey`, so the keyboard can focus
	    them. */
	register: Map<string, HTMLElement>;
}

/** One row: a name, what happened to it, and how far in it sits. */
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
	// The fade-in is the stylesheet's; a row only says when its turn is. React
	// mounts a DOM node per row that is new — a finished comparison, an opened
	// folder, a filter letting rows back in — so the animation runs exactly when
	// rows appear and never on a row that was already there.
	//
	// Pinned at mount: rows renumber as folders open and the filter narrows, and
	// handing a settled row a later delay would drop it back into its own
	// animation and flash it.
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

/** The twisty. A file has nothing to open, so it holds the space instead. */
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

/**
 * Which of the three glyphs a row shows. The name is chosen once and both the
 * icon and `data-icon` follow from it, so what the row says it is drawing and
 * what it draws cannot come apart.
 */
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
