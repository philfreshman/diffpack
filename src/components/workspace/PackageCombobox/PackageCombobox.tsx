import { useNavigate } from "@tanstack/react-router";
import { type RefObject, useEffect, useRef, useState } from "react";
import { useSetting } from "#/components/storage/useSetting.ts";
import { Combobox } from "#/components/ui/Combobox/Combobox.tsx";
import { SearchIcon } from "#/components/ui/icons.tsx";
import { Kbd } from "#/components/ui/Kbd/Kbd.tsx";
import { Spinner } from "#/components/ui/Spinner/Spinner.tsx";
import { useKeyShortcut } from "#/components/ui/useKeyShortcut.ts";
import type { RegistryAdapter } from "#/lib/registries/types.ts";
import { addToHistory } from "#/lib/storage/searchHistory.ts";
import { searchHistory } from "#/lib/storage/settings.ts";
import { buildPath } from "#/lib/url/slug.ts";
import { usePackageSearch } from "../usePackageSearch.ts";
import styles from "./PackageCombobox.module.css";

/** The key that jumps to the field, the way a search box is reached on the web. */
const SHORTCUT = "/";
/** The key that empties it, once there is something in it to empty. */
const CLEAR = "Escape";

export interface PackageComboboxProps {
	adapter: RegistryAdapter;
	/** The package the URL names — the field's value, not a suggestion. */
	selected: string;
}

/**
 * Search for a package, or type its name out in full. Choosing one writes the
 * URL: the selection is the address, so back/forward and a shared link mean the
 * same thing (§4.3, URL tier).
 */
export function PackageCombobox({ adapter, selected }: PackageComboboxProps) {
	const navigate = useNavigate();
	const [inputValue, setInputValue] = useState(selected);
	// Stored, which the server cannot see, so history arrives after mount.
	// Until then the list is empty rather than wrong.
	const history = useSetting(searchHistory(adapter.id));

	const input = useShortcutFocus();
	useEscapeToClear(input, reset);

	// The URL can change without this field: back/forward, or a link elsewhere in
	// the app. Whatever the address says is what the input shows.
	useEffect(() => setInputValue(selected), [selected]);

	const { results, loading, searching } = usePackageSearch(adapter, inputValue);
	// An empty field offers where the user has been; a typed one, what the
	// registry answered.
	const items = searching ? results : history.value;

	function choose(name: string) {
		const trimmed = name.trim();
		if (!trimmed) return;

		const entry = results.find((result) => result.name === trimmed) ?? {
			name: trimmed,
		};
		history.set(addToHistory(history.value, entry));

		setInputValue(trimmed);
		// A new package invalidates the versions and the file that were in the URL.
		navigate({ to: buildPath(adapter, { package: trimmed }) });
	}

	// Clearing the field lets go of the package too, and of the versions and the
	// file that depended on it.
	function reset() {
		setInputValue("");
		navigate({ to: buildPath(adapter, {}) });
	}

	// Three states, one slot: a package is locked in, the registry is answering,
	// or the field is waiting to be typed in.
	const state = selected ? "selected" : loading ? "searching" : "idle";

	return (
		<div className={styles.field}>
			<span className={styles.label}>Package Name</span>
			<Combobox
				label="Package Name"
				items={items}
				inputValue={inputValue}
				onInputValueChange={setInputValue}
				onSelect={(item) => choose(item.name)}
				// Enter with nothing highlighted takes the text as typed. It is the
				// only way to reach a Go module, whose search resolves one exact path.
				onSubmitText={choose}
				itemToText={(item) => item.name}
				renderItem={(item) => (
					<>
						<strong className={styles.name}>{item.name}</strong>
						{item.description ? (
							<span className={styles.description}>{item.description}</span>
						) : null}
					</>
				)}
				// The registry already answered the query; filtering again locally
				// would hide results whose name does not contain what was typed.
				filter={null}
				loading={loading}
				loadingMessage="Searching…"
				// Go has no discovery search, so an empty list is not a miss — it is
				// the field telling the user what it can actually resolve.
				emptyMessage={
					adapter.capabilities.searchHint ??
					(searching ? "No packages found" : "Type to search")
				}
				placeholder={adapter.capabilities.searchPlaceholder}
				leading={<SearchIcon width="16" height="16" />}
				trailing={<SearchState state={state} filled={inputValue !== ""} />}
				inputRef={input}
				keyShortcut={SHORTCUT}
			/>
		</div>
	);
}

/**
 * Selected as well as focused, so the next keystroke replaces the package
 * rather than adding to its name: jumping to the field is asking for another.
 */
function useShortcutFocus() {
	const input = useRef<HTMLInputElement>(null);
	useKeyShortcut(SHORTCUT, () => {
		input.current?.focus();
		input.current?.select();
	});

	return input;
}

/**
 * Escape is layered: an open list closes first and keeps what was typed (the
 * combobox's own behaviour), and Escape with the list shut empties the field.
 * Read on the input itself, ahead of Base UI's handler, so `aria-expanded`
 * still says whether this press is the one that closes the list.
 */
function useEscapeToClear(
	input: RefObject<HTMLInputElement | null>,
	onClear: () => void,
) {
	const handler = useRef(onClear);
	handler.current = onClear;

	useEffect(() => {
		const element = input.current;
		if (!element) return;

		function onKeyDown(event: KeyboardEvent) {
			if (event.key !== CLEAR || !element?.value) return;
			if (element.getAttribute("aria-expanded") === "true") return;
			handler.current();
		}

		element.addEventListener("keydown", onKeyDown);
		return () => element.removeEventListener("keydown", onKeyDown);
	}, [input]);
}

/**
 * The input's trailing slot: the key that does something next. `/` reaches an
 * empty field, esc empties a full one. An open popup makes the rest of the
 * document inert (Base UI's answer to outside clicks), so the slot carries a
 * test id — inside that subtree there is no accessible role to find it by.
 */
function SearchState({
	state,
	filled,
}: {
	state: "selected" | "searching" | "idle";
	filled: boolean;
}) {
	return (
		<span
			className={styles.trailing}
			data-testid="package-search-state"
			data-state={state}
		>
			{state === "searching" && <Spinner label="Searching packages" />}
			{filled ? (
				<Kbd keys="esc" />
			) : (
				// Stood down while the field has focus: by then it has been found.
				<Kbd className={styles.shortcut} keys={SHORTCUT} />
			)}
		</span>
	);
}
