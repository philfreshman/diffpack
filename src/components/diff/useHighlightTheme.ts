import { useEffect } from "react";
import { useSetting } from "#/components/storage/useSetting.ts";
import { useResolvedTheme } from "#/components/theme/useResolvedTheme.ts";
import { themeStylesheet } from "#/lib/diff/highlightStylesheet.ts";
import type { HighlightAppearance } from "#/lib/diff/highlightThemes.ts";
import {
	defaultHighlightTheme,
	highlightAppearance,
} from "#/lib/diff/highlightThemes.ts";
import { HIGHLIGHT_THEME } from "#/lib/storage/settings.ts";

/** The one `<link>` the picker owns, created the first time it is needed. */
const LINK_ID = "highlight-theme";

export interface HighlightThemeControls {
	/** The theme in force, or `null` before the stored choice has been read. */
	theme: string | null;
	/**
	 * The ground that theme paints on. The viewer wears it as `data-syntax` and
	 * takes its own surfaces from it — see `highlightAppearance`.
	 */
	appearance: HighlightAppearance | null;
	choose(theme: string): void;
}

/**
 * Which highlight.js theme the code is coloured with, and the stylesheet that
 * does the colouring.
 *
 * The stylesheet is a `<link>` rather than inlined text: the browser caches it,
 * and swapping themes is then one attribute write. Held here rather than in the
 * control that changes it, because what the code looks like is not the menu's
 * property — the menu is only where it is chosen.
 */
export function useHighlightTheme(): HighlightThemeControls {
	const pageTheme = useResolvedTheme();
	const chosen = useSetting(HIGHLIGHT_THEME);
	// Null until both are known: neither can be read on the server, and guessing
	// at them in the first client render is a hydration mismatch. A visitor who
	// has never chosen follows light/dark; one who has keeps what they chose.
	const theme =
		chosen.known && pageTheme
			? (chosen.value ?? defaultHighlightTheme(pageTheme))
			: null;

	useEffect(() => {
		if (!theme) return;
		const href = themeStylesheet(theme);
		if (href) stylesheetLink().href = href;
	}, [theme]);

	return {
		theme,
		appearance: highlightAppearance(theme),
		choose: chosen.set,
	};
}

function stylesheetLink(): HTMLLinkElement {
	const existing = document.getElementById(LINK_ID);
	if (existing instanceof HTMLLinkElement) return existing;

	const link = document.createElement("link");
	link.id = LINK_ID;
	link.rel = "stylesheet";
	document.head.append(link);

	return link;
}
