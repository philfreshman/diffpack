import { useRef } from "react";
import { IconButton } from "#/components/ui/IconButton/IconButton.tsx";
import { FilterIcon, SearchIcon } from "#/components/ui/icons.tsx";
import { Kbd } from "#/components/ui/Kbd/Kbd.tsx";
import { useKeyShortcut } from "#/components/ui/useKeyShortcut.ts";
import {
	TREE_COLLAPSED_ATTRIBUTE,
	toggleTreeCollapsed,
} from "#/lib/tree/prefs.ts";
import styles from "./TreeFilter.module.css";

export interface TreeFilterProps {
	filter: string;
	onFilterChange(filter: string): void;
	onlyModified: boolean;
	onOnlyModifiedChange(onlyModified: boolean): void;
}

/** The key that jumps to the field, shown in it the way a dashboard's Find is. */
const SHORTCUT = "f";

/**
 * The two controls above the tree. Both narrow it, and neither is a search:
 * the tree is already here, so typing hides rows rather than fetching any.
 */
export function TreeFilter({
	filter,
	onFilterChange,
	onlyModified,
	onOnlyModifiedChange,
}: TreeFilterProps) {
	const input = useRef<HTMLInputElement>(null);
	// A shut sidebar is opened first: a hidden field cannot take focus.
	useKeyShortcut(SHORTCUT, () => {
		if (document.documentElement.hasAttribute(TREE_COLLAPSED_ATTRIBUTE)) {
			toggleTreeCollapsed(document);
		}
		input.current?.focus();
	});

	return (
		<div className={styles.controls}>
			<div className={styles.field} data-filled={filter ? "" : undefined}>
				<SearchIcon className={styles.searchIcon} width="16" height="16" />
				<input
					ref={input}
					type="search"
					className={styles.input}
					aria-label="Filter files and folders"
					aria-keyshortcuts={SHORTCUT.toUpperCase()}
					placeholder="Find"
					value={filter}
					onChange={(event) => onFilterChange(event.target.value)}
				/>
				<Kbd className={styles.shortcut} keys={SHORTCUT.toUpperCase()} />
			</div>
			<IconButton
				aria-label="Show only modified files"
				aria-pressed={onlyModified}
				title="Toggle show only modified files"
				className={styles.toggle}
				onClick={() => onOnlyModifiedChange(!onlyModified)}
			>
				<FilterIcon width="16" height="16" />
			</IconButton>
		</div>
	);
}
