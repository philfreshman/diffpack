import { describe, expect, test } from "bun:test";
import {
	defaultHighlightTheme,
	HIGHLIGHT_THEMES,
	type HighlightTheme,
	highlightAppearance,
} from "#/lib/diff/highlightThemes.ts";

describe("HIGHLIGHT_THEMES", () => {
	test("offers the twenty-three themes the old picker did", () => {
		expect(HIGHLIGHT_THEMES).toHaveLength(23);
	});
});

function stylesheetPath({ asset }: HighlightTheme): string {
	return asset.startsWith("/")
		? `public${asset}`
		: `node_modules/highlight.js/styles/${asset}`;
}

describe("every theme's stylesheet exists", () => {
	// The old picker found a stylesheet by suffix-matching a recursive glob, so
	// a theme highlight.js had dropped simply stopped working with no sign of
	// it. Naming the file makes an upgrade that moves one fail here instead.
	test.each([...HIGHLIGHT_THEMES])("$label", async (theme) => {
		expect(await Bun.file(stylesheetPath(theme)).exists()).toBe(true);
	});
});

/**
 * The `background` of a stylesheet's `.hljs` rule — the ground it paints the
 * code on, and the one thing that says whether it is a light theme or a dark
 * one.
 */
function hljsBackground(css: string): string {
	const rule = /^\.hljs\s*\{([^}]*)\}/m.exec(css)?.[1];
	const background = rule && /background:\s*([^;\n]+)/.exec(rule)?.[1];
	if (!background) throw new Error("no `.hljs` background in the stylesheet");

	return background.trim();
}

/** Rec. 709 luma of a `#rgb`/`#rrggbb` colour, or of `white`/`black`. */
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
	// `appearance` is what the viewer keys its own surfaces off, and it is
	// written down rather than read from the stylesheet — so an upstream
	// restyle that flips a theme's ground has to fail here, not in a diff a
	// reader cannot make out. Windows 95 is the reason this is checked rather
	// than inferred from the label: it is a black theme with a light-sounding
	// name.
	test.each([...HIGHLIGHT_THEMES])("$label", async (theme) => {
		const css = await Bun.file(stylesheetPath(theme)).text();
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
		// The old app's light default was `"github"`, which was never one of its
		// own options, so a light-mode visitor saw an empty select.
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
		// The viewer leaves `data-syntax` off for these, which is what keeps the
		// page theme's surfaces standing until the choice is known.
		expect(highlightAppearance(null)).toBeNull();
		expect(highlightAppearance("github")).toBeNull();
	});
});
