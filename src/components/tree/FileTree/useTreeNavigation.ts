import { useRef, useState } from "react";
import { treeCommand } from "#/lib/tree/keymap.ts";
import { rowKey, type TreeRow } from "#/lib/tree/visibility.ts";

interface TreeActions {
	onOpenFile(path: string): void;
	onToggleFolder(path: string, expanded: boolean): void;
}

export function useTreeNavigation(
	rows: readonly TreeRow[],
	selectedIndex: number,
	{ onOpenFile, onToggleFolder }: TreeActions,
) {
	// By key, not index: filtering and expanding renumber the rows.
	const [focusedKey, setFocusedKey] = useState("");
	const elementsRef = useRef(new Map<string, HTMLElement>());

	const index = rows.findIndex((row) => rowKey(row.entry) === focusedKey);
	const activeIndex = index >= 0 ? index : Math.max(selectedIndex, 0);
	const activeRow = rows[activeIndex];
	const activeKey = activeRow ? rowKey(activeRow.entry) : "";

	function focusRow(row: TreeRow) {
		setFocusedKey(rowKey(row.entry));
		const element = elementsRef.current.get(rowKey(row.entry));
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

	return { activeKey, elementsRef, setFocusedKey, activate, handleKeyDown };
}
