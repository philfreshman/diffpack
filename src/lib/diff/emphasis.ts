import type { Rgb } from "#/lib/diff/colour.ts";
import type { HighlightAppearance } from "#/lib/diff/highlightThemes.ts";

export type ChangeSide = "added" | "removed";

export interface EmphasisInput {
	side: ChangeSide;
	hints: readonly Rgb[];
	surface: Rgb;
	tokens: readonly Rgb[];
	fallback: Rgb;
}

type SideColours = Record<ChangeSide, Rgb>;

export const ROW_SURFACES: Record<HighlightAppearance, SideColours> = {
	light: {
		added: { r: 0xe6, g: 0xff, b: 0xec },
		removed: { r: 0xff, g: 0xee, b: 0xf0 },
	},
	dark: {
		added: { r: 0x23, g: 0x33, b: 0x29 },
		removed: { r: 0x44, g: 0x2d, b: 0x30 },
	},
};

export const DEFAULT_EMPHASIS: Record<HighlightAppearance, SideColours> = {
	light: {
		added: { r: 0xac, g: 0xf2, b: 0xbd },
		removed: { r: 0xfd, g: 0xb8, b: 0xc0 },
	},
	dark: {
		added: { r: 0x33, g: 0x6d, b: 0x43 },
		removed: { r: 0x71, g: 0x32, b: 0x39 },
	},
};

const STRONGEST_MIX = 0.6;
const WEAKEST_MIX = 0.15;
const MIX_STEP = 0.05;

const READABLE_CONTRAST = 4.5;
const VISIBLE_CONTRAST = 1.2;

const MIN_HINT_SATURATION = 0.25;
const HINT_LIGHTNESS = { min: 0.1, max: 0.9 };

const FULL_TURN_DEGREES = 360;
const HUE_SECTOR_DEGREES = 60;
const GREEN_SECTOR_START = 2;
const BLUE_SECTOR_START = 4;

interface HueRange {
	from: number;
	to: number;
}

const SIDE_HUES: Record<ChangeSide, HueRange> = {
	added: { from: 70, to: 170 },
	removed: { from: 320, to: 30 },
};

const LUMINANCE_WEIGHTS = { r: 0.2126, g: 0.7152, b: 0.0722 };
const LINEAR_SEGMENT_END = 0.04045;
const LINEAR_SEGMENT_SLOPE = 12.92;
const GAMMA_OFFSET = 0.055;
const GAMMA_EXPONENT = 2.4;
const CONTRAST_FLARE = 0.05;
const CHANNEL_MAX = 255;

function linearChannel(channel: number): number {
	const fraction = channel / CHANNEL_MAX;

	return fraction <= LINEAR_SEGMENT_END
		? fraction / LINEAR_SEGMENT_SLOPE
		: ((fraction + GAMMA_OFFSET) / (1 + GAMMA_OFFSET)) ** GAMMA_EXPONENT;
}

function relativeLuminance({ r, g, b }: Rgb): number {
	return (
		LUMINANCE_WEIGHTS.r * linearChannel(r) +
		LUMINANCE_WEIGHTS.g * linearChannel(g) +
		LUMINANCE_WEIGHTS.b * linearChannel(b)
	);
}

function contrastRatio(first: Rgb, second: Rgb): number {
	const firstLuminance = relativeLuminance(first);
	const secondLuminance = relativeLuminance(second);
	const lighter = Math.max(firstLuminance, secondLuminance);
	const darker = Math.min(firstLuminance, secondLuminance);

	return (lighter + CONTRAST_FLARE) / (darker + CONTRAST_FLARE);
}

function mixChannel(from: number, to: number, strength: number): number {
	return Math.round(from + (to - from) * strength);
}

function mix(from: Rgb, to: Rgb, strength: number): Rgb {
	return {
		r: mixChannel(from.r, to.r, strength),
		g: mixChannel(from.g, to.g, strength),
		b: mixChannel(from.b, to.b, strength),
	};
}

interface HslTone {
	hue: number;
	saturation: number;
	lightness: number;
}

function hueSector({ r, g, b }: Rgb, brightest: number, chroma: number) {
	if (chroma === 0) return 0;
	if (brightest === r) return (g - b) / chroma;
	if (brightest === g) return (b - r) / chroma + GREEN_SECTOR_START;
	return (r - g) / chroma + BLUE_SECTOR_START;
}

function hueDegrees(colour: Rgb, brightest: number, chroma: number): number {
	const degrees = hueSector(colour, brightest, chroma) * HUE_SECTOR_DEGREES;

	return (degrees + FULL_TURN_DEGREES) % FULL_TURN_DEGREES;
}

function hslTone(colour: Rgb): HslTone {
	const brightest = Math.max(colour.r, colour.g, colour.b);
	const dimmest = Math.min(colour.r, colour.g, colour.b);
	const chroma = brightest - dimmest;
	const lightness = (brightest + dimmest) / 2 / CHANNEL_MAX;
	const saturation =
		chroma === 0 ? 0 : chroma / CHANNEL_MAX / (1 - Math.abs(2 * lightness - 1));

	return {
		hue: hueDegrees(colour, brightest, chroma),
		saturation,
		lightness,
	};
}

function isHueWithin(hue: number, { from, to }: HueRange): boolean {
	const wrapsPastZero = from > to;

	return wrapsPastZero ? hue >= from || hue <= to : hue >= from && hue <= to;
}

function isClearlySideColour(side: ChangeSide, hint: Rgb): boolean {
	const { hue, saturation, lightness } = hslTone(hint);

	return (
		saturation >= MIN_HINT_SATURATION &&
		lightness >= HINT_LIGHTNESS.min &&
		lightness <= HINT_LIGHTNESS.max &&
		isHueWithin(hue, SIDE_HUES[side])
	);
}

function strengthsStrongestFirst(): number[] {
	const stepCount = Math.round((STRONGEST_MIX - WEAKEST_MIX) / MIX_STEP);

	return Array.from({ length: stepCount + 1 }, (_, step) =>
		Number((STRONGEST_MIX - step * MIX_STEP).toFixed(2)),
	);
}

function requiredContrast(token: Rgb, fallback: Rgb): number {
	return Math.min(READABLE_CONTRAST, contrastRatio(token, fallback));
}

function keepsTokensReadable(
	{ tokens, fallback }: EmphasisInput,
	mark: Rgb,
): boolean {
	return tokens.every(
		(token) => contrastRatio(token, mark) >= requiredContrast(token, fallback),
	);
}

function standsOutFrom(surface: Rgb, mark: Rgb): boolean {
	return contrastRatio(mark, surface) >= VISIBLE_CONTRAST;
}

function isSafeMark(input: EmphasisInput, mark: Rgb): boolean {
	return standsOutFrom(input.surface, mark) && keepsTokensReadable(input, mark);
}

function safeMarkFrom(input: EmphasisInput, hint: Rgb): Rgb | undefined {
	if (!isClearlySideColour(input.side, hint)) return undefined;

	return strengthsStrongestFirst()
		.map((strength) => mix(input.surface, hint, strength))
		.find((mark) => isSafeMark(input, mark));
}

export function emphasisColour(input: EmphasisInput): Rgb {
	for (const hint of input.hints) {
		const mark = safeMarkFrom(input, hint);
		if (mark) return mark;
	}

	return input.fallback;
}

const HEX_RADIX = 16;
const HEX_CHANNEL_DIGITS = 2;

function hexChannel(channel: number): string {
	return channel.toString(HEX_RADIX).padStart(HEX_CHANNEL_DIGITS, "0");
}

export function toHex({ r, g, b }: Rgb): string {
	return `#${hexChannel(r)}${hexChannel(g)}${hexChannel(b)}`;
}
