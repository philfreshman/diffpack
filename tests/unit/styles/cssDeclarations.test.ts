import { describe, expect, test } from "bun:test";
import { parseDeclarations } from "./cssDeclarations.ts";

describe("parseDeclarations", () => {
	test("reads each declaration with its line", () => {
		const css = ".a {\n\tcolor: var(--color-foreground);\n\tgap: 0\n}";

		expect(parseDeclarations(css)).toEqual([
			{ line: 2, property: "color", value: "var(--color-foreground)" },
			{ line: 3, property: "gap", value: "0" },
		]);
	});

	test("skips comments without shifting lines", () => {
		const css =
			"/* padding: 10px;\n color: red; */\n.a { margin: 0; /* x: 1px; */ }";

		expect(parseDeclarations(css)).toEqual([
			{ line: 3, property: "margin", value: "0" },
		]);
	});

	test("joins a value that spans lines", () => {
		const css =
			".a {\n\ttransition:\n\t\topacity var(--duration-fast) ease,\n\t\tcolor var(--duration-fast) ease;\n}";

		expect(parseDeclarations(css)).toEqual([
			{
				line: 2,
				property: "transition",
				value:
					"opacity var(--duration-fast) ease, color var(--duration-fast) ease",
			},
		]);
	});

	test("reads declarations nested in at-rules and selectors, not their preludes", () => {
		const css = `@media (min-width: 53rem) {
	.a:hover { padding: 0; }
}
@keyframes spin { to { transform: rotate(1turn); } }
.b { &:focus-visible { outline: none } }`;

		expect(parseDeclarations(css).map(({ property }) => property)).toEqual([
			"padding",
			"transform",
			"outline",
		]);
	});

	test("counts a custom property definition, keeping its case", () => {
		expect(parseDeclarations(".a { --Tile-Accent: 1 2 3; }")).toEqual([
			{ line: 1, property: "--Tile-Accent", value: "1 2 3" },
		]);
	});

	test("does not split inside strings or parentheses", () => {
		const css = `.a { content: "a; b}"; background: url(data:image/png;base64,AA); }`;

		expect(parseDeclarations(css)).toEqual([
			{ line: 1, property: "content", value: '"a; b}"' },
			{
				line: 1,
				property: "background",
				value: "url(data:image/png;base64,AA)",
			},
		]);
	});

	test("ignores statement at-rules", () => {
		expect(parseDeclarations('@import url("x.css");\n@layer a, b;')).toEqual(
			[],
		);
	});
});
