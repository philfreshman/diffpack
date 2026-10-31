import { describe, expect, test } from "bun:test";
import { readThemeColours } from "#/lib/diff/themeColours.ts";

describe("readThemeColours background, text and change hints", () => {
	test("reads the `.hljs` background and base colour", () => {
		const css = ".hljs {\n  background: #102030;\n  color: #a0b0c0;\n}";

		const colours = readThemeColours(css);

		expect(colours.background).toEqual({ r: 16, g: 32, b: 48 });
		expect(colours.text).toEqual([{ r: 160, g: 176, b: 192 }]);
	});

	test("lists the addition's background before its text colour", () => {
		const css = `.hljs { background: #000000 }
.hljs-addition { color: #00ff00; background-color: #003300 }`;

		expect(readThemeColours(css).addition).toEqual([
			{ r: 0, g: 51, b: 0 },
			{ r: 0, g: 255, b: 0 },
		]);
	});

	test("falls back to the addition's text colour when it has no background", () => {
		const css = `.hljs { background: #000000 }
.hljs-addition { color: #00ff00 }`;

		expect(readThemeColours(css).addition).toEqual([{ r: 0, g: 255, b: 0 }]);
	});

	test("has no addition hint when the theme does not style additions", () => {
		const css = ".hljs { background: #000000 }";

		expect(readThemeColours(css).addition).toEqual([]);
	});

	test("reads the deletion hint the same way as the addition hint", () => {
		const css = `.hljs { background: #000000 }
.hljs-deletion { color: #ff0000; background: #330000 }`;

		expect(readThemeColours(css).deletion).toEqual([
			{ r: 51, g: 0, b: 0 },
			{ r: 255, g: 0, b: 0 },
		]);
	});
});

describe("readThemeColours selectors and comments", () => {
	test("counts a colour shared in a selector list for `.hljs-addition`", () => {
		const css = `.hljs { background: #000000 }
.hljs-addition,
.hljs-attribute,
.hljs-meta .hljs-string {
  color: #98c379
}`;

		expect(readThemeColours(css).addition).toEqual([
			{ r: 152, g: 195, b: 121 },
		]);
	});

	test("does not count a descendant selector for the class it descends from", () => {
		const css = `.hljs { background: #000000 }
.hljs-addition .hljs-string,
.hljs-deletion > .hljs-string { color: #98c379 }`;

		const colours = readThemeColours(css);

		expect(colours.addition).toEqual([]);
		expect(colours.deletion).toEqual([]);
	});

	test("skips comments, including ones that look like rules", () => {
		const css = `/* Theme { by someone } */
.hljs { background: #000000 }
/* .hljs-deletion { color: #ff0000 } */
/* Additions */
.hljs-addition { color: #00ff00 }`;

		const colours = readThemeColours(css);

		expect(colours.addition).toEqual([{ r: 0, g: 255, b: 0 }]);
		expect(colours.deletion).toEqual([]);
	});
});

describe("readThemeColours colour values", () => {
	test.each([
		["#123", { r: 17, g: 34, b: 51 }],
		["#AbCdEf", { r: 171, g: 205, b: 239 }],
		["#11223380", { r: 17, g: 34, b: 51 }],
		["rgb(10, 20, 30)", { r: 10, g: 20, b: 30 }],
		["rgba(163, 190, 140, 0.5)", { r: 163, g: 190, b: 140 }],
		["rgb(10 20 30 / 50%)", { r: 10, g: 20, b: 30 }],
		["white", { r: 255, g: 255, b: 255 }],
		["black", { r: 0, g: 0, b: 0 }],
		["#123456 !important", { r: 18, g: 52, b: 86 }],
	])("reads the colour written as %s", (written, expected) => {
		const css = `.hljs { background: ${written} }`;

		expect(readThemeColours(css).background).toEqual(expected);
	});

	test("skips values it cannot read as a colour", () => {
		const css = `.hljs { background: #000000; color: inherit }
.hljs-addition { background: linear-gradient(#000, #fff); color: #00ff00 }
.hljs-deletion { background-color: transparent; color: currentColor }`;

		const colours = readThemeColours(css);

		expect(colours.text).toEqual([{ r: 0, g: 255, b: 0 }]);
		expect(colours.addition).toEqual([{ r: 0, g: 255, b: 0 }]);
		expect(colours.deletion).toEqual([]);
	});

	test("refuses a stylesheet with no `.hljs` background", () => {
		const css = ".hljs { background: transparent; color: #ffffff }";

		expect(() => readThemeColours(css)).toThrow("no `.hljs` background");
	});
});

describe("readThemeColours across several rules", () => {
	test("collects each text colour of the highlight rules once", () => {
		const css = `.hljs { background: #000000; color: #ffffff }
.hljs-keyword { color: #ff00ff }
.hljs-meta .hljs-string { color: #00ffff }
.hljs-title { color: #FFF }
.hljs-literal { color: #ff00ff }
.diff-viewer { color: #123456 }`;

		expect(readThemeColours(css).text).toEqual([
			{ r: 255, g: 255, b: 255 },
			{ r: 255, g: 0, b: 255 },
			{ r: 0, g: 255, b: 255 },
		]);
	});

	test("lets a later rule override an earlier one for the same selector", () => {
		const css = `.hljs { background: #000000; color: #111111 }
.hljs-addition { background-color: #003300 }
.hljs, .hljs-subst { color: #222222 }
.hljs-addition { background: #004400 }
.hljs { background-color: #ffffff }`;

		const colours = readThemeColours(css);

		expect(colours.background).toEqual({ r: 255, g: 255, b: 255 });
		expect(colours.text).toEqual([{ r: 34, g: 34, b: 34 }]);
		expect(colours.addition).toEqual([{ r: 0, g: 68, b: 0 }]);
	});

	test("ignores pseudo-class and pseudo-element rules such as `::selection`", () => {
		const css = `.hljs { background: #000000 }
.hljs::selection,
.hljs ::selection { background-color: #444444 }
.hljs-addition:hover { color: #00ff00 }`;

		const colours = readThemeColours(css);

		expect(colours.background).toEqual({ r: 0, g: 0, b: 0 });
		expect(colours.addition).toEqual([]);
	});
});
