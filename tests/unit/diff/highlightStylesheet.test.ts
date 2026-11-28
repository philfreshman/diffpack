import { describe, expect, test } from "vite-plus/test";
import { themeStylesheet } from "#/lib/diff/highlightStylesheet.ts";
import { HIGHLIGHT_THEMES } from "#/lib/diff/highlightThemes.ts";

const PUBLIC_ASSET_PREFIX = "/";

const packagedThemes = HIGHLIGHT_THEMES.filter(
	(theme) => !theme.asset.startsWith(PUBLIC_ASSET_PREFIX),
);
const publicThemes = HIGHLIGHT_THEMES.filter((theme) =>
	theme.asset.startsWith(PUBLIC_ASSET_PREFIX),
);

describe("themeStylesheet", () => {
	test.each(packagedThemes)(
		"finds the highlight.js stylesheet for $label",
		(theme) => {
			expect(themeStylesheet(theme.value)).toContain(theme.asset);
		},
	);

	test.each(publicThemes)("serves $label from public/ as it is", (theme) => {
		expect(themeStylesheet(theme.value)).toBe(theme.asset);
	});

	test("has nothing for a theme it does not offer", () => {
		expect(themeStylesheet("not-a-theme")).toBeNull();
	});
});
