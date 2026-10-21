import { describe, expect, test } from "bun:test";
import {
	BLANK,
	DRAWN_GLYPHS,
	FAINTEST_VISIBLE_INK,
	glyphFor,
} from "#/lib/asciiTrail/glyphs.ts";

describe("glyphFor", () => {
	test("leaves an empty cell blank", () => {
		expect(glyphFor(0)).toBe(BLANK);
	});

	test("draws a full cell with the heaviest glyph", () => {
		expect(glyphFor(1)).toBe("○");
	});

	test("steps from faint to strong as the ink thickens", () => {
		const glyphs = [0.2, 0.3, 0.45, 0.8].map(glyphFor);
		expect(glyphs).toEqual([BLANK, "_", ">", "○"]);
	});

	test("clamps ink outside the 0 to 1 range", () => {
		expect(glyphFor(-0.5)).toBe(BLANK);
		expect(glyphFor(3)).toBe("○");
	});
});

describe("FAINTEST_VISIBLE_INK", () => {
	test("is where a blank cell first gets a glyph", () => {
		expect(glyphFor(FAINTEST_VISIBLE_INK - 0.001)).toBe(BLANK);
		expect(glyphFor(FAINTEST_VISIBLE_INK + 0.001)).toBe("_");
	});
});

describe("DRAWN_GLYPHS", () => {
	test("lists every glyph that reaches the canvas, and no blank", () => {
		expect(DRAWN_GLYPHS).toEqual(["○", ">", "_"]);
	});
});
