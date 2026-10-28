import { useRef } from "react";
import { SearchIcon } from "#/components/ui/icons.tsx";
import { Kbd } from "#/components/ui/Kbd/Kbd.tsx";
import { useKeyShortcut } from "#/components/ui/useKeyShortcut.ts";
import { sidebar } from "#/lib/tree/sidebar.ts";
import styles from "./TreeFilter.module.css";

export interface TreeFilterProps {
	filter: string;
	onFilterChange(filter: string): void;
}

const SHORTCUT = "f";

export function TreeFilter({ filter, onFilterChange }: TreeFilterProps) {
	const input = useRef<HTMLInputElement>(null);
	// A shut sidebar is opened first: a hidden field cannot take focus.
	useKeyShortcut(SHORTCUT, () => {
		sidebar.open();
		input.current?.focus();
	});

	return (
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
	);
}
