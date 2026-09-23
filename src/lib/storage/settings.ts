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

/**
 * Every preference diffpack keeps between visits, each declared once: the key
 * it is stored under, how a stored string is read, and what a visitor with
 * nothing stored gets. Read and write them through `storedSetting.ts` — or
 * `useSetting` in a component — and in `<head>` through `readInHead`.
 *
 * The keys and the stored spellings are a contract with returning visitors —
 * most of them are the old app's, kept so its visitors' choices still stand —
 * and renaming one, or changing what it stores, silently drops their choice.
 * `tests/e2e/parity.spec.ts` holds them from outside the page.
 */

/** Light, dark, or whatever the operating system says. */
export const THEME_SELECTION = oneOf({
	key: "theme",
	values: SELECTIONS,
	fallback: DEFAULT_SELECTION,
});

/** Unified unless the visitor asked for split. */
export const SPLIT_VIEW = flag({
	key: "split-view-preference",
	fallback: false,
});

/**
 * Whitespace-exact unless the visitor asked otherwise. The diff boot script
 * reads it too, so a deep link's tree is built the way it will be shown.
 */
export const IGNORE_WHITESPACE = flag({
	key: "ignore-whitespace-preference",
	fallback: false,
});

/**
 * The highlight.js theme the visitor chose, or `null` for one who has not:
 * that default follows the page theme, so it is worked out where the page
 * theme is known (`defaultHighlightTheme`) rather than stored. A value that is
 * no longer one of the offered themes — the old app's `"github"` among them —
 * is not a choice that can be honoured, so it reads as no choice at all.
 */
export const HIGHLIGHT_THEME = oneOf({
	key: "highlight_theme",
	values: HIGHLIGHT_THEMES.map((theme) => theme.value),
	fallback: null,
});

/**
 * The tree panel's width in pixels: wide enough to read a path, narrow enough
 * to leave the diff room. These are the panel's bounds as well as the stored
 * value's — a stored width can come from an older build, a smaller screen or a
 * hand-edited key, and the panel has to stay usable whichever it was.
 */
export const TREE_WIDTH = clampedInteger({
	key: "tree_panel_width",
	min: 220,
	max: 640,
	fallback: 320,
});

/** Open unless the visitor shut it. */
export const TREE_COLLAPSED = flag({
	key: "tree_panel_collapsed",
	fallback: false,
});

/**
 * On unless the visitor has turned it off — a comparison is about what
 * changed, and the unchanged files are context. So only the literal `"false"`
 * turns it off.
 */
export const ONLY_MODIFIED = flag({
	key: "tree_show_only_modified",
	fallback: true,
});

const histories = new Map<RegistryId, StoredSetting<readonly SearchResult[]>>();

/**
 * Recent picks, one list per registry, kept as JSON under the old app's keys —
 * `search_history_npm` and its siblings. No script in `<head>` reads it, so it
 * has no source to carry. The same object for a registry every time, so a
 * component reads it once on mount rather than on every render.
 */
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
