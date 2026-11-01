import { describe, expect, test } from "bun:test";
import { Glob } from "bun";
import { normalizeWhitespace } from "./cssDeclarations.ts";
import {
	findViolations,
	formatViolation,
	type RuleId,
	type Violation,
} from "./tokenRules.ts";

type AllowedException = {
	file: string;
	property: string;
	value: string;
	reason: string;
};

const ALLOWED: AllowedException[] = [
	{
		file: "src/components/landing/RegistryTile/RegistryTile.module.css",
		property: "box-shadow",
		value:
			"0 0 20px rgb(var(--tile-accent) / 0.4), 0 0 40px rgb(var(--tile-accent) / 0.3)",
		reason:
			"The landing tile's coloured glow. Nothing else glows, so a role token would have one user.",
	},
	{
		file: "src/components/review/FileCard/FileCard.module.css",
		property: "animation",
		value: "shimmer 1.4s ease-in-out infinite",
		reason:
			"A looping placeholder shimmer: the period is the animation's character, not a UI transition.",
	},
	{
		file: "src/components/ui/Spinner/Spinner.module.css",
		property: "animation",
		value: "spin 800ms linear infinite",
		reason: "The spinner's rotation period, a looping animation.",
	},
	{
		file: "src/routes/index.module.css",
		property: "animation",
		value: "cosmicShift 20s ease-in-out infinite alternate",
		reason: "The landing backdrop's slow hue drift, a looping animation.",
	},
	{
		file: "src/components/workspace/DiffProgress/DiffProgress.module.css",
		property: "--step-height",
		value: "1.75rem",
		reason:
			"Layout geometry: the progress box reserves its height from the step count before steps render.",
	},
	{
		file: "src/components/workspace/DiffProgress/DiffProgress.module.css",
		property: "--summary-height",
		value: "13.75rem",
		reason:
			"Layout geometry: the summary's height, reserved so progress and summary swap without a jump.",
	},
	{
		file: "src/components/workspace/DiffWorkspace/DiffWorkspace.module.css",
		property: "margin",
		value: "-1px",
		reason:
			"The standard visually-hidden idiom for a screen-reader-only heading.",
	},
	{
		file: "src/components/workspace/ViewportCenter/ViewportCenter.module.css",
		property: "--window-middle-to-stage-bottom",
		value: "50dvh",
		reason:
			"Viewport geometry: half the window, to centre on the window rather than the stage.",
	},
];

const CSS_MODULES = new Glob("src/**/*.module.css");
const SKILL = ".claude/skills/ui-component/SKILL.md";

async function moduleViolations(): Promise<Violation[]> {
	const files = [...CSS_MODULES.scanSync(".")].sort();
	const sources = await Promise.all(
		files.map(async (file) => ({ file, css: await Bun.file(file).text() })),
	);
	return sources.flatMap(({ file, css }) => findViolations(file, css));
}

function covers(exception: AllowedException, violation: Violation): boolean {
	return (
		exception.file === violation.file &&
		exception.property === violation.property &&
		normalizeWhitespace(exception.value) === violation.value
	);
}

function isAllowed(violation: Violation): boolean {
	return ALLOWED.some((exception) => covers(exception, violation));
}

function rulesBroken(css: string): RuleId[] {
	return findViolations("inline.module.css", css).map(({ rule }) => rule);
}

describe("CSS modules use role tokens", () => {
	test("no declaration uses a raw value", async () => {
		const uncovered = (await moduleViolations()).filter(
			(violation) => !isAllowed(violation),
		);

		expect(
			uncovered.map(formatViolation),
			`${uncovered.length} declarations use raw values. Pick the role token from ${SKILL}, or add a role token to src/styles/globals.css; a real exception goes in ALLOWED with a reason.`,
		).toEqual([]);
	});

	test("every ALLOWED exception still covers a violation", async () => {
		const violations = await moduleViolations();
		const stale = ALLOWED.filter(
			(exception) =>
				!violations.some((violation) => covers(exception, violation)),
		);

		expect(
			stale,
			"These ALLOWED entries no longer match a violating declaration: remove them.",
		).toEqual([]);
	});
});

const HOSTILE: [css: string, rules: RuleId[]][] = [
	["padding: 10px", ["length"]],
	["margin-inline: calc(100% - 2rem)", ["length"]],
	["gap: max(1ch, var(--space-2))", ["length"]],
	["border-bottom: 1px solid var(--color-border)", ["length"]],
	["outline-offset: -1px", ["length"]],
	["--x: 13px", ["length"]],
	["--depth-indent: calc(var(--depth) * 18px)", ["length"]],
	["font-size: var(--text-sm)", ["type"]],
	["font-weight: 700", ["type"]],
	["line-height: 1.4", ["type"]],
	["letter-spacing: 0.05em", ["type"]],
	["font-family: monospace", ["type"]],
	["font: 12px/1 sans-serif", ["type"]],
	["border-radius: var(--radius-md)", ["radius"]],
	["border-top-left-radius: 4px", ["radius"]],
	["color: #fff", ["colour"]],
	["background: #aabbccdd", ["colour"]],
	["color: red", ["colour"]],
	["border-color: rgb(0 0 0 / 0.15)", ["colour"]],
	["background: hsl(var(--hue) 50% 40%)", ["colour"]],
	["--accent: oklch(0.7 0.1 200)", ["colour"]],
	["box-shadow: 0 8px 24px rgb(0 0 0 / 0.15)", ["length", "colour"]],
	[
		"box-shadow: 0 0 0 env(safe-area-inset-top) var(--color-border)",
		["shadow"],
	],
	["transition: opacity 150ms", ["motion"]],
	["animation: spin 0.8s linear infinite", ["motion"]],
	["z-index: 5", ["layer"]],
	["z-index: calc(var(--z-overlay) + var(--depth))", ["layer"]],
	["color: var(--gray-500)", ["ramp"]],
];

const ALLOWED_CASES = [
	"padding: 0 var(--space-2)",
	"padding: 0",
	"margin: 0px",
	"width: 28rem",
	"line-height: var(--leading-code)",
	"font-weight: var(--weight-strong) !important",
	"border-radius: var(--radius-control) var(--radius-control) 0 0",
	"background: rgb(var(--tile-accent) / 0.3)",
	"outline-offset: calc(-1 * var(--focus-ring-width))",
	"border: var(--border-width) solid var(--color-border)",
	"color: var(--color-red-ish)",
	"color: currentColor",
	"background: transparent",
	"background: color-mix(in srgb, var(--color-added) 12%, var(--color-background))",
	"box-shadow: none",
	"box-shadow: var(--shadow-popover)",
	"box-shadow: 0 0 0 var(--focus-ring-width) var(--color-focus-ring)",
	"transition: color var(--duration-fast) ease",
	"animation-delay: calc(var(--index) * var(--duration-instant))",
	"z-index: var(--z-overlay)",
	"z-index: calc(var(--z-overlay) + 1)",
	"z-index: auto",
	'content: "red 10px #fff"',
	"background-image: url(#gradient)",
];

describe("token rules", () => {
	test.each(HOSTILE)("%p breaks %p", (declaration, rules) => {
		expect(rulesBroken(`.a { ${declaration}; }`)).toEqual(rules);
	});

	test.each(ALLOWED_CASES)("%p is allowed", (declaration) => {
		expect(rulesBroken(`.a { ${declaration}; }`)).toEqual([]);
	});

	test("a class name that spells a colour is not a colour", () => {
		expect(rulesBroken(".redLabel, .white { display: block; }")).toEqual([]);
	});

	test("a media query is not a declaration", () => {
		const css = "@media (min-width: 53rem) { .a { display: grid; } }";
		expect(rulesBroken(css)).toEqual([]);
	});

	test("names the file, line, declaration and rule", () => {
		const [violation] = findViolations(
			"src/Foo/Foo.module.css",
			".a {\n\tdisplay: flex;\n\tpadding:  10px\n\t\t4px;\n}",
		);

		expect(violation && formatViolation(violation)).toBe(
			"src/Foo/Foo.module.css:3 padding: 10px 4px — use a --space-*, --gap-*, --padding-*, --border-width* or focus-ring token instead of a length literal",
		);
	});
});
