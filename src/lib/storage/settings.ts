import { HIGHLIGHT_THEMES } from "#/lib/diff/highlightThemes.ts";
import type { RegistryId, SearchResult } from "#/lib/registries/types.ts";
import { DEFAULT_SELECTION, SELECTIONS } from "#/lib/theme.ts";
import { parseHistory } from "./searchHistory.ts";
import {
	clampedInteger,
	flag,
	oneOf,
	type StoredSetting,
} from "./storedSetting.ts";

// Keys and stored spellings are a contract with returning visitors: never change
// an existing one. `tests/e2e/parity.spec.ts` holds them.

export const THEME_SELECTION = oneOf({
	key: "theme",
	values: SELECTIONS,
	fallback: DEFAULT_SELECTION,
});

export const SPLIT_VIEW = flag({
	key: "split-view-preference",
	fallback: false,
});

/** The diff boot script reads it too. */
export const IGNORE_WHITESPACE = flag({
	key: "ignore-whitespace-preference",
	fallback: false,
});

export const SHOW_SIGNS = flag({
	key: "show-signs-preference",
	fallback: true,
});

// `null` means no choice: the default follows the page theme. A theme no longer
// offered (the old app's `"github"`) reads as `null`.
export const HIGHLIGHT_THEME = oneOf({
	key: "highlight_theme",
	values: HIGHLIGHT_THEMES.map((theme) => theme.value),
	fallback: null,
});

/** In pixels. Also the panel's resize bounds. */
export const TREE_WIDTH = clampedInteger({
	key: "tree_panel_width",
	min: 220,
	max: 640,
	fallback: 320,
});

export const TREE_COLLAPSED = flag({
	key: "tree_panel_collapsed",
	fallback: false,
});

export const ONLY_MODIFIED = flag({
	key: "tree_show_only_modified",
	fallback: true,
});

const histories = new Map<RegistryId, StoredSetting<readonly SearchResult[]>>();

// The same object per registry, so a component reads it once on mount.
export function searchHistory(
	registry: RegistryId,
): StoredSetting<readonly SearchResult[]> {
	let setting = histories.get(registry);
	if (!setting) {
		setting = {
			key: `search_history_${registry}`,
			fallback: [],
			parse: parseHistory,
			serialize: (history) => JSON.stringify(history),
		};
		histories.set(registry, setting);
	}

	return setting;
}
