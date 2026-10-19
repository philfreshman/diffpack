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

const LINK_ID = "highlight-theme";

export interface HighlightThemeControls {
	/** `null` until the stored choice has been read. */
	theme: string | null;
	appearance: HighlightAppearance | null;
	choose(theme: string): void;
}

export function useHighlightTheme(): HighlightThemeControls {
	const pageTheme = useResolvedTheme();
	const chosen = useSetting(HIGHLIGHT_THEME);
	// Null until both are known: guessing in the first client render breaks hydration.
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
