import { TREE_COLLAPSED, TREE_WIDTH } from "#/lib/storage/settings.ts";
import { writeSetting } from "#/lib/storage/storedSetting.ts";

/**
 * The tree panel's layout on `<html>`: where its stored width and its shut
 * state meet the document. What is stored, and how it is read, is declared
 * with every other setting in `#/lib/storage/settings.ts`.
 */

/** Within the bounds the stored width is read within. */
export function clampTreeWidth(width: number): number {
	return Math.min(TREE_WIDTH.max, Math.max(TREE_WIDTH.min, width));
}

export const TREE_WIDTH_PROPERTY = "--tree-panel-width";

/**
 * The width lives in a custom property on `<html>` rather than in React state:
 * the pre-paint script writes it before hydration, and the drag rewrites it
 * without a render. One value, one owner, no flash.
 */
export function applyTreeWidth(doc: Document, width: number): void {
	doc.documentElement.style.setProperty(TREE_WIDTH_PROPERTY, `${width}px`);
}

export const TREE_COLLAPSED_ATTRIBUTE = "data-tree-collapsed";

/**
 * Collapsed is an attribute on `<html>`, for the same reason the width is a
 * custom property there: the pre-paint script sets it, the stylesheet hides
 * the panel off it, and the two buttons that flip it never need a render to
 * agree on which of them is showing.
 */
export function toggleTreeCollapsed(doc: Document): boolean {
	const collapsed = !doc.documentElement.hasAttribute(TREE_COLLAPSED_ATTRIBUTE);
	doc.documentElement.toggleAttribute(TREE_COLLAPSED_ATTRIBUTE, collapsed);
	writeSetting(TREE_COLLAPSED, collapsed);

	return collapsed;
}
