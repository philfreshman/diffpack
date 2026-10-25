import { describe, expect, test } from "bun:test";
import type { Rgb } from "#/lib/diff/colour.ts";
import {
	type ChangeSide,
	DEFAULT_EMPHASIS,
	ROW_SURFACES,
	toHex,
} from "#/lib/diff/emphasis.ts";
import {
	HIGHLIGHT_THEMES,
	type HighlightAppearance,
	stylesheetFile,
} from "#/lib/diff/highlightThemes.ts";
import { readThemeColours } from "#/lib/diff/themeColours.ts";
import { emphasisStyle, themeEmphasis } from "#/lib/diff/themeEmphasis.ts";
import { THEME_EMPHASIS } from "#/lib/diff/themeEmphasis.gen.ts";
import { contrast } from "./contrast.ts";

const SIDES: readonly ChangeSide[] = ["added", "removed"];

function rgb(hex: string): Rgb {
	const value = Number.parseInt(hex.slice(1), 16);

	return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff };
}

describe("THEME_EMPHASIS", () => {
	test.each([...HIGHLIGHT_THEMES])(
		"is current for $label (run `bun run generate-emphasis`)",
		async (theme) => {
			const css = await Bun.file(stylesheetFile(theme)).text();

			expect(THEME_EMPHASIS[theme.value]).toEqual(
				themeEmphasis(css, theme.appearance),
			);
		},
	);

	test.each([...HIGHLIGHT_THEMES])(
		"leaves no $label token less readable than today's mark",
		async (theme) => {
			const { text } = readThemeColours(
				await Bun.file(stylesheetFile(theme)).text(),
			);
			const entry = THEME_EMPHASIS[theme.value];
			if (!entry) throw new Error(`no entry for ${theme.value}`);

			for (const side of SIDES) {
				const mark = rgb(entry[side]);
				const today = DEFAULT_EMPHASIS[theme.appearance][side];
				for (const token of text) {
					expect(contrast(token, mark)).toBeGreaterThanOrEqual(
						Math.min(4.5, contrast(token, today)),
					);
				}
			}
		},
	);

	test("gives some themes a tint of their own", () => {
		expect(THEME_EMPHASIS["atom-one-dark"]?.added).not.toBe("#336d43");
		expect(THEME_EMPHASIS.monokai?.removed).toBe("#713239");
	});
});

function cssToken(css: string, block: string, name: string): string {
	const body = css.slice(css.indexOf(block)).split("}")[0] ?? "";
	const value = new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`).exec(body)?.[1];
	if (!value) throw new Error(`no --${name} in ${block}`);

	return value;
}

describe("the colours the maths starts from", () => {
	const blocks: Record<HighlightAppearance, string> = {
		light: ':root,\n[data-syntax="light"] {',
		dark: ':root[data-theme="dark"],\n[data-syntax="dark"] {',
	};

	test.each(["light", "dark"] as const)(
		"match globals.css on %s rows",
		async (appearance) => {
			const css = await Bun.file("src/styles/globals.css").text();

			for (const side of SIDES) {
				const block = blocks[appearance];
				expect(toHex(ROW_SURFACES[appearance][side])).toBe(
					cssToken(css, block, `color-${side}-surface`),
				);
				expect(toHex(DEFAULT_EMPHASIS[appearance][side])).toBe(
					cssToken(css, block, `color-${side}-emphasis`),
				);
			}
		},
	);
});

describe("emphasisStyle", () => {
	test("sets the two emphasis colours for a theme", () => {
		expect(emphasisStyle("monokai")).toEqual({
			"--color-added-emphasis": "#4a682b",
			"--color-removed-emphasis": "#713239",
		});
	});

	test("leaves the stylesheet's colours alone before a theme is known", () => {
		expect(emphasisStyle(null)).toBeUndefined();
		expect(emphasisStyle("github")).toBeUndefined();
	});
});
