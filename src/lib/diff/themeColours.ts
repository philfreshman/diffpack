import type { Rgb } from "#/lib/diff/colour.ts";

export interface ThemeColours {
	background: Rgb;
	text: Rgb[];
	addition: Rgb[];
	deletion: Rgb[];
}

type ColourProperty = "background" | "color";
type Styles = Map<ColourProperty, Rgb>;

interface Rule {
	targets: string[];
	colours: [ColourProperty, Rgb][];
}

const COMMENT = /\/\*[\s\S]*?\*\//g;
const RULE = /([^{}]+)\{([^{}]*)\}/g;
const COMBINATOR = /\s*[\s>+~]\s*/;
const PSEUDO_SELECTOR = ":";
const CLASS_NAME = /\.([\w-]+)/g;
const BASE_CLASS = "hljs";
const TOKEN_CLASS_PREFIX = "hljs-";
const COLOUR_PROPERTIES: Record<string, ColourProperty> = {
	background: "background",
	"background-color": "background",
	color: "color",
};
const IMPORTANT = /\s*!important$/i;
const SHORT_HEX = /^#([0-9a-f]{3}|[0-9a-f]{4})$/i;
const LONG_HEX = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_FUNCTION = /^rgba?\(([^)]*)\)$/i;
const RGB_SEPARATOR = /[\s,/]+/;
const MAX_CHANNEL = 255;
const NAMED_COLOURS: Record<string, Rgb> = {
	white: { r: MAX_CHANNEL, g: MAX_CHANNEL, b: MAX_CHANNEL },
	black: { r: 0, g: 0, b: 0 },
};

function parseRules(css: string): Rule[] {
	const uncommented = css.replace(COMMENT, "");
	return [...uncommented.matchAll(RULE)].map(
		([, selectors = "", body = ""]) => ({
			targets: selectors.split(",").flatMap(targetsOf),
			colours: parseColourDeclarations(body),
		}),
	);
}

function targetsOf(selector: string): string[] {
	const subject = selector.trim().split(COMBINATOR).at(-1) ?? "";
	if (subject.includes(PSEUDO_SELECTOR)) return [];
	return [...subject.matchAll(CLASS_NAME)]
		.map(([, className = ""]) => className)
		.filter(isHighlightClass);
}

function isHighlightClass(className: string): boolean {
	return className === BASE_CLASS || className.startsWith(TOKEN_CLASS_PREFIX);
}

function parseColourDeclarations(body: string): [ColourProperty, Rgb][] {
	return body.split(";").flatMap((declaration): [ColourProperty, Rgb][] => {
		const [name = "", ...value] = declaration.split(":");
		const property = COLOUR_PROPERTIES[name.trim().toLowerCase()];
		const colour = parseColour(value.join(":"));
		return property && colour ? [[property, colour]] : [];
	});
}

function parseColour(value: string): Rgb | null {
	const colour = value.trim().replace(IMPORTANT, "").toLowerCase();
	return (
		NAMED_COLOURS[colour] ??
		parseShortHex(colour) ??
		parseLongHex(colour) ??
		parseRgbFunction(colour)
	);
}

function parseShortHex(colour: string): Rgb | null {
	const digits = SHORT_HEX.exec(colour)?.[1];
	if (!digits) return null;
	return parseLongHex(`#${[...digits].map((digit) => digit + digit).join("")}`);
}

function parseLongHex(colour: string): Rgb | null {
	const digits = LONG_HEX.exec(colour)?.[1];
	if (!digits) return null;
	const [r, g, b] = [0, 2, 4].map((at) =>
		Number.parseInt(digits.slice(at, at + 2), 16),
	);
	return toRgb([r, g, b]);
}

function parseRgbFunction(colour: string): Rgb | null {
	const channels = RGB_FUNCTION.exec(colour)?.[1];
	if (!channels) return null;
	return toRgb(channels.trim().split(RGB_SEPARATOR).slice(0, 3).map(Number));
}

function isChannel(value: number | undefined): value is number {
	return (
		value !== undefined &&
		Number.isFinite(value) &&
		value >= 0 &&
		value <= MAX_CHANNEL
	);
}

function toRgb([r, g, b]: (number | undefined)[]): Rgb | null {
	if (!isChannel(r) || !isChannel(g) || !isChannel(b)) return null;
	return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
}

function stylesByTarget(rules: Rule[]): Map<string, Styles> {
	const styles = new Map<string, Styles>();
	for (const { targets, colours } of rules) {
		for (const target of targets) {
			const targetStyles: Styles = styles.get(target) ?? new Map();
			for (const [property, colour] of colours) {
				targetStyles.set(property, colour);
			}
			styles.set(target, targetStyles);
		}
	}
	return styles;
}

function distinctColours(colours: Rgb[]): Rgb[] {
	const byKey = new Map(colours.map((colour) => [colourKey(colour), colour]));
	return [...byKey.values()];
}

function colourKey({ r, g, b }: Rgb): string {
	return `${r},${g},${b}`;
}

function hintsOf(styles: Styles | undefined): Rgb[] {
	return [styles?.get("background"), styles?.get("color")].filter(
		(colour) => colour !== undefined,
	);
}

export function readThemeColours(css: string): ThemeColours {
	const styles = stylesByTarget(parseRules(css));
	const background = styles.get(BASE_CLASS)?.get("background");
	if (!background) throw new Error("no `.hljs` background in the stylesheet");

	return {
		background,
		text: distinctColours(
			[...styles.values()].flatMap((target) => target.get("color") ?? []),
		),
		addition: hintsOf(styles.get(`${TOKEN_CLASS_PREFIX}addition`)),
		deletion: hintsOf(styles.get(`${TOKEN_CLASS_PREFIX}deletion`)),
	};
}
