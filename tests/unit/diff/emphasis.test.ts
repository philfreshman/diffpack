import { describe, expect, test } from "bun:test";
import type { Rgb } from "#/lib/diff/colour.ts";
import {
	type ChangeSide,
	DEFAULT_EMPHASIS,
	emphasisColour,
	ROW_SURFACES,
	toHex,
} from "#/lib/diff/emphasis.ts";
import type { HighlightAppearance } from "#/lib/diff/highlightThemes.ts";
import { contrast } from "./contrast.ts";

function rgb(hex: string): Rgb {
	const value = Number.parseInt(hex.slice(1), 16);

	return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff };
}

const GITHUB_DARK_BRIGHT_TOKENS = [
	"#e6edf3",
	"#a5d6ff",
	"#d2a8ff",
	"#79c0ff",
	"#ffa657",
	"#7ee787",
];

const GITHUB_DARK_TOKENS = [...GITHUB_DARK_BRIGHT_TOKENS, "#ff7b72", "#8b949e"];

function rowInput(
	appearance: HighlightAppearance,
	side: ChangeSide,
	hints: Rgb[],
	tokens: string[],
) {
	return {
		side,
		hints,
		surface: ROW_SURFACES[appearance][side],
		tokens: tokens.map(rgb),
		fallback: DEFAULT_EMPHASIS[appearance][side],
	};
}

function darkInput(side: ChangeSide, hints: Rgb[], tokens: string[]) {
	return rowInput("dark", side, hints, tokens);
}

function lightInput(side: ChangeSide, hints: Rgb[], tokens: string[]) {
	return rowInput("light", side, hints, tokens);
}

describe("emphasisColour falls back", () => {
	test("when the theme gives no hint", () => {
		expect(emphasisColour(darkInput("added", [], ["#e6edf3"]))).toEqual(
			rgb("#336d43"),
		);
	});

	test("when the hint is a grey, like Monokai's comment-coloured deletions", () => {
		const input = darkInput("removed", [rgb("#75715e")], ["#f8f8f2"]);

		expect(emphasisColour(input)).toEqual(rgb("#713239"));
	});

	test("when the hint is the other side's hue, like green for a removal", () => {
		const input = darkInput(
			"removed",
			[rgb("#2ea043")],
			GITHUB_DARK_BRIGHT_TOKENS,
		);

		expect(emphasisColour(input)).toEqual(rgb("#713239"));
	});

	test("when the hint is too close to black to read as a colour", () => {
		const input = lightInput("added", [rgb("#021a0a")], []);

		expect(emphasisColour(input)).toEqual(rgb("#acf2bd"));
	});

	test("when the hint is too close to white to read as a colour", () => {
		const input = darkInput("added", [rgb("#e0ffe8")], []);

		expect(emphasisColour(input)).toEqual(rgb("#336d43"));
	});
});

function keepsTokensReadable(
	{ tokens, fallback }: { tokens: readonly Rgb[]; fallback: Rgb },
	mark: Rgb,
): boolean {
	return tokens.every(
		(token) =>
			contrast(token, mark) >= Math.min(4.5, contrast(token, fallback)),
	);
}

describe("emphasisColour mixes the hint into the row surface", () => {
	const input = darkInput("added", [rgb("#2ea043")], GITHUB_DARK_BRIGHT_TOKENS);
	const mark = emphasisColour(input);

	test("at the strongest strength that keeps every token readable", () => {
		expect(mark).toEqual(rgb("#296a36"));
	});

	test("so the mark stands out from the row and keeps the tokens' contrast", () => {
		expect(mark).not.toEqual(input.fallback);
		expect(contrast(mark, input.surface)).toBeGreaterThanOrEqual(1.2);
		expect(keepsTokensReadable(input, mark)).toBe(true);
	});

	test("on the removed side too, for a red hint", () => {
		const removed = darkInput(
			"removed",
			[rgb("#f85149")],
			GITHUB_DARK_BRIGHT_TOKENS,
		);

		expect(emphasisColour(removed)).toEqual(rgb("#713636"));
	});
});

describe("emphasisColour backs off a hint that would drown the tokens", () => {
	const ONE_DARK_BRIGHT_TOKENS = ["#abb2bf", "#98c379", "#e6c07b"];
	const ONE_DARK_COMMENT = "#5c6370";
	const ONE_DARK_ADDITION = rgb("#98c379");

	test("to a weaker strength that still keeps the tokens readable", () => {
		const input = darkInput(
			"added",
			[ONE_DARK_ADDITION],
			ONE_DARK_BRIGHT_TOKENS,
		);
		const mark = emphasisColour(input);

		expect(mark).toEqual(rgb("#4c6545"));
		expect(mark).not.toEqual(rgb("#698959"));
		expect(contrast(mark, input.surface)).toBeGreaterThanOrEqual(1.2);
		expect(keepsTokensReadable(input, mark)).toBe(true);
	});

	test("leaves a dim comment no less readable than on today's mark", () => {
		const input = darkInput(
			"added",
			[ONE_DARK_ADDITION],
			[...ONE_DARK_BRIGHT_TOKENS, ONE_DARK_COMMENT],
		);

		const mark = emphasisColour(input);

		expect(mark).toEqual(rgb("#4c6545"));
		expect(keepsTokensReadable(input, mark)).toBe(true);
	});
});

describe("emphasisColour on a light row", () => {
	const GITHUB_ADDITION = rgb("#22863a");
	const GITHUB_TEXT = "#24292e";
	const GITHUB_COMMENT = "#6a737d";

	test("darkens the row toward the hint when the tokens stay readable", () => {
		const input = lightInput("added", [GITHUB_ADDITION], [GITHUB_TEXT]);
		const mark = emphasisColour(input);

		expect(mark).toEqual(rgb("#70b681"));
		expect(contrast(mark, input.surface)).toBeGreaterThanOrEqual(1.2);
		expect(keepsTokensReadable(input, mark)).toBe(true);
	});

	test("backs off to a paler mark so a comment stays at 4.5", () => {
		const input = lightInput(
			"added",
			[GITHUB_ADDITION],
			[GITHUB_TEXT, GITHUB_COMMENT],
		);

		const mark = emphasisColour(input);

		expect(mark).toEqual(rgb("#c9edd1"));
		expect(keepsTokensReadable(input, mark)).toBe(true);
	});
});

describe("emphasisColour falls back when no strength stands out from the row", () => {
	test("as with GitHub Dark's addition background, as dark as the row itself", () => {
		const input = darkInput("added", [rgb("#033a16")], GITHUB_DARK_TOKENS);

		expect(emphasisColour(input)).toEqual(rgb("#336d43"));
	});

	test("unless a later hint, like GitHub Dark's addition text colour, does", () => {
		const input = darkInput(
			"added",
			[rgb("#033a16"), rgb("#aff5b4")],
			GITHUB_DARK_TOKENS,
		);

		expect(emphasisColour(input)).toEqual(rgb("#46644c"));
	});
});

describe("toHex", () => {
	test("writes lowercase, zero-padded #rrggbb", () => {
		expect(toHex({ r: 10, g: 0, b: 171 })).toBe("#0a00ab");
	});
});
