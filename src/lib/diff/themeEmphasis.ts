import {
	type ChangeSide,
	DEFAULT_EMPHASIS,
	emphasisColour,
	ROW_SURFACES,
	toHex,
} from "#/lib/diff/emphasis.ts";
import type { HighlightAppearance } from "#/lib/diff/highlightThemes.ts";
import { readThemeColours } from "#/lib/diff/themeColours.ts";
import { THEME_EMPHASIS } from "#/lib/diff/themeEmphasis.gen.ts";

export type EmphasisPair = Record<ChangeSide, string>;

const EMPHASIS_PROPERTIES: Record<ChangeSide, string> = {
	added: "--color-added-emphasis",
	removed: "--color-removed-emphasis",
};

export function themeEmphasis(
	css: string,
	appearance: HighlightAppearance,
): EmphasisPair {
	const { text, addition, deletion } = readThemeColours(css);
	const markFor = (side: ChangeSide, hints: typeof addition) =>
		toHex(
			emphasisColour({
				side,
				hints,
				surface: ROW_SURFACES[appearance][side],
				tokens: text,
				fallback: DEFAULT_EMPHASIS[appearance][side],
			}),
		);

	return {
		added: markFor("added", addition),
		removed: markFor("removed", deletion),
	};
}

export function emphasisStyle(
	theme: string | null,
): Record<string, string> | undefined {
	const pair = theme ? THEME_EMPHASIS[theme] : undefined;
	if (!pair) return undefined;

	return {
		[EMPHASIS_PROPERTIES.added]: pair.added,
		[EMPHASIS_PROPERTIES.removed]: pair.removed,
	};
}
