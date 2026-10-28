import { useNavigate } from "@tanstack/react-router";
import { type RefObject, useEffect, useEffectEvent, useRef } from "react";
import { useStateResetOn } from "#/components/lifecycle/useStateResetOn.ts";
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
import { RegistrySwitcher } from "../RegistrySwitcher/RegistrySwitcher.tsx";
import { usePackageSearch } from "../usePackageSearch.ts";
import styles from "./PackageCombobox.module.css";

const SHORTCUT = "/";
const CLEAR = "Escape";

export interface PackageComboboxProps {
	adapter: RegistryAdapter;
	selected: string;
}

export function PackageCombobox({ adapter, selected }: PackageComboboxProps) {
	const navigate = useNavigate();
	const [inputValue, setInputValue] = useStateResetOn(
		() => selected,
		[selected],
	);
	// localStorage, so history is empty until after hydration.
	const history = useSetting(searchHistory(adapter.id));

	const input = useShortcutFocus();
	useEscapeToClear(input, reset);

	const { results, loading, searching } = usePackageSearch(adapter, inputValue);
	const items = searching ? results : history.value;

	function choose(name: string) {
		const trimmed = name.trim();
		if (!trimmed) return;

		const entry = results.find((result) => result.name === trimmed) ?? {
			name: trimmed,
		};
		history.set(addToHistory(history.value, entry));

		setInputValue(trimmed);
		navigate({ to: buildPath(adapter, { package: trimmed }) });
	}

	function reset() {
		setInputValue("");
		navigate({ to: buildPath(adapter, {}) });
	}

	const state = selected ? "selected" : loading ? "searching" : "idle";

	return (
		<div className={styles.field}>
			<RegistrySwitcher adapter={adapter} />
			<div className={styles.search}>
				<span className={styles.label}>Package Name</span>
				<Combobox
					label="Package Name"
					items={items}
					inputValue={inputValue}
					onInputValueChange={setInputValue}
					onSelect={(item) => choose(item.name)}
					// Reaches a Go module that pkg.go.dev's search does not list, by its exact path.
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
					// Local filtering would hide results whose name lacks the typed text.
					filter={null}
					loading={loading}
					loadingMessage="Searching…"
					emptyMessage={searching ? "No packages found" : "Type to search"}
					placeholder={adapter.capabilities.searchPlaceholder}
					leading={<SearchIcon width="16" height="16" />}
					trailing={<SearchState state={state} />}
					inputRef={input}
					keyShortcut={SHORTCUT}
				/>
			</div>
		</div>
	);
}

function useShortcutFocus() {
	const input = useRef<HTMLInputElement>(null);
	useKeyShortcut(SHORTCUT, () => {
		input.current?.focus();
		input.current?.select();
	});

	return input;
}

// Escape on an open list only closes it. Listening on the input runs ahead of
// Base UI's handler, so `aria-expanded` still shows whether the list was open.
function useEscapeToClear(
	input: RefObject<HTMLInputElement | null>,
	onClear: () => void,
) {
	const handler = useEffectEvent(onClear);

	useEffect(() => {
		const element = input.current;
		if (!element) return;

		function onKeyDown(event: KeyboardEvent) {
			if (event.key !== CLEAR || !element?.value) return;
			if (element.getAttribute("aria-expanded") === "true") return;
			handler();
		}

		element.addEventListener("keydown", onKeyDown);
		return () => element.removeEventListener("keydown", onKeyDown);
	}, [input]);
}

// The test id is needed because an open popup makes this slot inert, leaving
// no accessible role to find it by.
function SearchState({ state }: { state: "selected" | "searching" | "idle" }) {
	return (
		<span
			className={styles.trailing}
			data-testid="package-search-state"
			data-state={state}
		>
			{state === "searching" && <Spinner label="Searching packages" />}
			<Kbd className={styles.shortcut} keys={SHORTCUT} />
		</span>
	);
}
