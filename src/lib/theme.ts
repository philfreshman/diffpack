export type ThemeSelection = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const DEFAULT_SELECTION: ThemeSelection = "dark";

/** In the order the toggle cycles through them. */
export const SELECTIONS: readonly ThemeSelection[] = [
	"light",
	"dark",
	"system",
];

export function resolveTheme(
	selection: ThemeSelection,
	prefersDark: boolean,
): ResolvedTheme {
	if (selection !== "system") return selection;
	return prefersDark ? "dark" : "light";
}

export function nextSelection(selection: ThemeSelection): ThemeSelection {
	const index = SELECTIONS.indexOf(selection);
	return SELECTIONS[(index + 1) % SELECTIONS.length] ?? DEFAULT_SELECTION;
}

// The literal `--color-canvas` values: the pre-paint script runs before any CSS.
export function themeColor(resolved: ResolvedTheme): string {
	return resolved === "light" ? "#fafafa" : "#000000";
}

const SELECTION_ATTRIBUTE = "data-theme-selection";
const THEME_ATTRIBUTE = "data-theme";

export function applyTheme(doc: Document, selection: ThemeSelection): void {
	const prefersDark = doc.defaultView
		? doc.defaultView.matchMedia("(prefers-color-scheme: dark)").matches
		: false;
	const resolved = resolveTheme(selection, prefersDark);

	doc.documentElement.setAttribute(THEME_ATTRIBUTE, resolved);
	doc.documentElement.setAttribute(SELECTION_ATTRIBUTE, selection);

	let meta = doc.head?.querySelector('meta[name="theme-color"]');
	if (!meta) {
		meta = doc.createElement("meta");
		meta.setAttribute("name", "theme-color");
		doc.head?.appendChild(meta);
	}
	meta.setAttribute("content", themeColor(resolved));
}

// Read what the pre-paint script applied rather than resolving it again.
export function readAppliedTheme(doc: Document): ResolvedTheme {
	return doc.documentElement.getAttribute(THEME_ATTRIBUTE) === "light"
		? "light"
		: "dark";
}
