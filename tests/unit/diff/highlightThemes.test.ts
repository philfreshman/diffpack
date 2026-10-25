import { describe, expect, test } from "bun:test";
import {
	defaultHighlightTheme,
	HIGHLIGHT_THEMES,
	highlightAppearance,
	stylesheetFile,
} from "#/lib/diff/highlightThemes.ts";

describe("HIGHLIGHT_THEMES", () => {
	test("offers the twenty-three themes the old picker did", () => {
		expect(HIGHLIGHT_THEMES).toHaveLength(23);
	});
});

describe("every theme's stylesheet exists", () => {
	// Named per file, so a highlight.js upgrade that drops a stylesheet fails here.
	test.each([...HIGHLIGHT_THEMES])("$label", async (theme) => {
		expect(await Bun.file(stylesheetFile(theme)).exists()).toBe(true);
	});
});

function hljsBackground(css: string): string {
	const rule = /^\.hljs\s*\{([^}]*)\}/m.exec(css)?.[1];
	const background = rule && /background:\s*([^;\n]+)/.exec(rule)?.[1];
	if (!background) throw new Error("no `.hljs` background in the stylesheet");

	return background.trim();
}

// Rec. 709 luma.
function luma(color: string): number {
	if (color === "white") return 1;
	if (color === "black") return 0;

	const hex = color.replace("#", "");
	const wide =
		hex.length === 3
			? [...hex].map((digit) => digit + digit).join("")
			: hex.slice(0, 6);
	const [r = 0, g = 0, b = 0] = [0, 2, 4].map(
		(at) => Number.parseInt(wide.slice(at, at + 2), 16) / 255,
	);

	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe("every theme's declared appearance is the one it paints", () => {
	// `appearance` is declared, not read from the stylesheet. Windows 95 is a black theme with a light-sounding name.
	test.each([...HIGHLIGHT_THEMES])("$label", async (theme) => {
		const css = await Bun.file(stylesheetFile(theme)).text();
		const light = luma(hljsBackground(css)) > 0.5;

		expect(light ? "light" : "dark").toBe(theme.appearance);
	});
});

describe("defaultHighlightTheme", () => {
	test("follows the page theme, for a visitor who has not picked one", () => {
		expect(defaultHighlightTheme("dark")).toBe("github-dark");
		expect(defaultHighlightTheme("light")).toBe("base16/github");
	});

	test("is always one of the themes on offer", () => {
		const offered = HIGHLIGHT_THEMES.map((theme) => theme.value);

		expect(offered).toContain(defaultHighlightTheme("dark"));
		expect(offered).toContain(defaultHighlightTheme("light"));
	});
});

describe("highlightAppearance", () => {
	test("says which ground a theme paints on", () => {
		expect(highlightAppearance("atom-one-light")).toBe("light");
		expect(highlightAppearance("atom-one-dark")).toBe("dark");
	});

	test("has no answer before a theme has been read, or for a stray value", () => {
		// The viewer leaves `data-syntax` off for these, keeping the page theme's surfaces until a choice is known.
		expect(highlightAppearance(null)).toBeNull();
		expect(highlightAppearance("github")).toBeNull();
	});
});
