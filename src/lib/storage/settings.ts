import { clampedInteger, flag } from "./storedSetting.ts";

/**
 * Every preference diffpack keeps between visits, each declared once: the key
 * it is stored under, how a stored string is read, and what a visitor with
 * nothing stored gets. Read and write them through `storedSetting.ts` — or
 * `useSetting` in a component — and in `<head>` through `readInHead`.
 *
 * The keys and the stored spellings are the old app's, and they are a contract
 * with returning visitors: renaming one, or changing what it stores, silently
 * drops their choice. `tests/e2e/parity.spec.ts` holds them from outside the
 * page.
 */

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
