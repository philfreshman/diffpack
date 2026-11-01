import { type Declaration, parseDeclarations } from "./cssDeclarations.ts";

export type RuleId =
	| "length"
	| "type"
	| "radius"
	| "colour"
	| "shadow"
	| "motion"
	| "layer"
	| "ramp";

export type Violation = Declaration & {
	file: string;
	rule: RuleId;
	message: string;
};

type Rule = {
	id: RuleId;
	message: string;
	appliesTo: (property: string) => boolean;
	isViolatedBy: (value: string) => boolean;
};

const LENGTH_UNITS = [
	"px",
	"rem",
	"em",
	"ex",
	"ch",
	"lh",
	"vh",
	"vw",
	"dvh",
	"svh",
	"lvh",
	"vmin",
	"vmax",
];
const TIME_UNITS = ["ms", "s"];

const LENGTH_CHECKED_PROPERTIES = [
	/^padding(-|$)/,
	/^margin(-|$)/,
	/^(row-|column-)?gap$/,
	/^border(?!.*radius$)(-|$)/,
	/^outline(-width|-offset)?$/,
	/^box-shadow$/,
	/^text-underline-offset$/,
	/^text-decoration-thickness$/,
	/^--/,
];

const TYPE_ROLES: { property: string; allowed: RegExp; message: string }[] = [
	{
		property: "font-size",
		allowed:
			/^(var\(--text-(caption|body|title|display|display-hero)\)|inherit)$/,
		message:
			"font-size takes a type role: var(--text-caption|body|title|display|display-hero) or inherit",
	},
	{
		property: "font-weight",
		allowed: /^(var\(--weight-(regular|medium|strong|display)\)|inherit)$/,
		message:
			"font-weight takes a weight role: var(--weight-regular|medium|strong|display) or inherit",
	},
	{
		property: "line-height",
		allowed: /^(var\(--leading-[\w-]+\)|inherit|normal)$/,
		message: "line-height takes var(--leading-*), inherit or normal",
	},
	{
		property: "letter-spacing",
		allowed: /^(var\(--tracking-[\w-]+\)|normal)$/,
		message: "letter-spacing takes var(--tracking-*) or normal",
	},
	{
		property: "font-family",
		allowed: /^(var\(--font-[\w-]+\)|inherit)$/,
		message: "font-family takes var(--font-*) or inherit",
	},
	{
		property: "font",
		allowed: /^inherit$/,
		message: "the font shorthand is only inherit; set the longhands with roles",
	},
];

const RADIUS_PROPERTY = /^border(-[a-z]+)*-radius$/;
const RADIUS_ROLE =
	/^(var\(--radius-(tag|control|surface|popover|tile|pill)\)|0|inherit)$/;

const SHADOW_TOKEN = /^(none|var\(--shadow-[\w-]+\))$/;
const SHADOW_PART =
	/^(inset|0|currentcolor|transparent|(var|calc|min|max|clamp|color-mix|rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(.*\))$/i;

const LAYER_TOKEN = /^(var\(--z-[\w-]+\)|0|auto)$/;
const LAYER_CALC = /^calc\(((var\(--z-[\w-]+\))|[\d.\s()*/+-])+\)$/;

const COLOUR_FUNCTION = /(?<![\w-])(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/gi;
const HEX_COLOUR = /#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/i;
const IDENTIFIER = /(?<![\w-])[a-z]+(?![\w(-])/gi;
const VAR_CALL = /var\([^()]*\)/g;

const NAMED_COLOURS = new Set(
	`aliceblue antiquewhite aqua aquamarine azure beige bisque black
	blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate
	coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod
	darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange
	darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray
	darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey
	dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold
	goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory
	khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral
	lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink
	lightsalmon lightseagreen lightskyblue lightslategray lightslategrey
	lightsteelblue lightyellow lime limegreen linen magenta maroon
	mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen
	mediumslateblue mediumspringgreen mediumturquoise mediumvioletred
	midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive
	olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise
	palevioletred papayawhip peachpuff peru pink plum powderblue purple
	rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen
	seashell sienna silver skyblue slateblue slategray slategrey snow springgreen
	steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke
	yellow yellowgreen`.split(/\s+/),
);

const RULES: Rule[] = [
	{
		id: "length",
		message:
			"use a --space-*, --gap-*, --padding-*, --border-width* or focus-ring token instead of a length literal",
		appliesTo: (property) =>
			LENGTH_CHECKED_PROPERTIES.some((pattern) => pattern.test(property)),
		isViolatedBy: (value) => nonZeroLiterals(value, LENGTH_UNITS).length > 0,
	},
	...TYPE_ROLES.map(({ property, allowed, message }): Rule => ({
		id: "type",
		message,
		appliesTo: (candidate) => candidate === property,
		isViolatedBy: (value) => !allowed.test(value),
	})),
	{
		id: "radius",
		message:
			"border-radius takes a shape role: var(--radius-tag|control|surface|popover|tile|pill), 0 or inherit",
		appliesTo: (property) => RADIUS_PROPERTY.test(property),
		isViolatedBy: (value) =>
			!splitOutsideParens(value, /[\s/]/).every((part) =>
				RADIUS_ROLE.test(part),
			),
	},
	{
		id: "colour",
		message:
			"use a semantic --color-* token (or color-mix of tokens) instead of a colour literal",
		appliesTo: () => true,
		isViolatedBy: hasColourLiteral,
	},
	{
		id: "shadow",
		message:
			"box-shadow is none, var(--shadow-*), or a composition of token lengths and token colours",
		appliesTo: (property) => property === "box-shadow",
		isViolatedBy: (value) =>
			!SHADOW_TOKEN.test(value) && shadowHasUntokenedPart(value),
	},
	{
		id: "motion",
		message: "use var(--duration-*) instead of a time literal",
		appliesTo: (property) => /^(transition|animation)(-|$)/.test(property),
		isViolatedBy: (value) => nonZeroLiterals(value, TIME_UNITS).length > 0,
	},
	{
		id: "layer",
		message: "z-index takes var(--z-*), a calc() of those, 0 or auto",
		appliesTo: (property) => property === "z-index",
		isViolatedBy: (value) =>
			!LAYER_TOKEN.test(value) &&
			!(LAYER_CALC.test(value) && value.includes("var(--z-")),
	},
	{
		id: "ramp",
		message: "use a semantic --color-* token, not a raw --gray-* ramp",
		appliesTo: () => true,
		isViolatedBy: (value) => value.includes("var(--gray-"),
	},
];

export function findViolations(file: string, css: string): Violation[] {
	return parseDeclarations(css).flatMap((declaration) =>
		RULES.filter(
			(rule) =>
				rule.appliesTo(declaration.property) &&
				rule.isViolatedBy(withoutImportant(declaration.value)),
		).map(({ id, message }) => ({ ...declaration, file, rule: id, message })),
	);
}

export function formatViolation(violation: Violation): string {
	const { file, line, property, value, message } = violation;
	return `${file}:${line} ${property}: ${value} — ${message}`;
}

function withoutImportant(value: string): string {
	return value.replace(/\s*!important$/i, "");
}

function withoutReferences(value: string): string {
	return value
		.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, " ")
		.replace(/url\([^)]*\)/gi, " ")
		.replace(/--[\w-]+/g, " ");
}

function nonZeroLiterals(value: string, units: string[]): string[] {
	const literal = new RegExp(
		`(?<![\\w.])[-+]?(\\d+\\.?\\d*|\\.\\d+)(${units.join("|")})(?![\\w-])`,
		"gi",
	);
	return [...withoutReferences(value).matchAll(literal)]
		.filter((match) => Number(match[1]) !== 0)
		.map((match) => match[0]);
}

function hasColourLiteral(value: string): boolean {
	const bare = withoutReferences(value);
	return (
		HEX_COLOUR.test(bare) ||
		hasNamedColour(bare) ||
		colourFunctionArguments(value).some(hasLiteralChannels)
	);
}

function hasNamedColour(bare: string): boolean {
	return [...bare.matchAll(IDENTIFIER)].some(([word]) =>
		NAMED_COLOURS.has(word.toLowerCase()),
	);
}

function colourFunctionArguments(value: string): string[] {
	return [...value.matchAll(COLOUR_FUNCTION)].map((match) =>
		argumentsFrom(value, match.index + match[0].length),
	);
}

function argumentsFrom(value: string, start: number): string {
	let depth = 1;
	for (let index = start; index < value.length; index++) {
		if (value[index] === "(") depth++;
		if (value[index] === ")") depth--;
		if (depth === 0) return value.slice(start, index);
	}
	return value.slice(start);
}

function hasLiteralChannels(args: string): boolean {
	const [channels = ""] = splitOutsideParens(args, /\//);
	const withoutVars = removeVarCalls(channels);
	return withoutVars === channels || /[\d#]/.test(withoutVars);
}

function removeVarCalls(text: string): string {
	const reduced = text.replace(VAR_CALL, " ");
	return reduced === text ? text : removeVarCalls(reduced);
}

function shadowHasUntokenedPart(value: string): boolean {
	return splitOutsideParens(value, /[\s,]/).some(
		(part) => !SHADOW_PART.test(part) && !isReportedElsewhere(part),
	);
}

function isReportedElsewhere(part: string): boolean {
	return (
		nonZeroLiterals(part, LENGTH_UNITS).length > 0 || hasColourLiteral(part)
	);
}

function splitOutsideParens(value: string, separator: RegExp): string[] {
	const parts: string[] = [];
	let current = "";
	let depth = 0;

	for (const char of value) {
		if (char === "(") depth++;
		if (char === ")") depth--;
		if (depth === 0 && separator.test(char)) {
			parts.push(current);
			current = "";
		} else current += char;
	}

	return [...parts, current].filter((part) => part !== "");
}
