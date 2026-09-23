import { flag } from "./storedSetting.ts";

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
