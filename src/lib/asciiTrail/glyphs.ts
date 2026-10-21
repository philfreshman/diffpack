export const BLANK = " ";

const STRONG_TO_FAINT = ["○", ">", "_", BLANK] as const;
const CONTRAST = 2;
const GAMMA = 0.5;

export const DRAWN_GLYPHS: readonly string[] = STRONG_TO_FAINT.filter(
	(glyph) => glyph !== BLANK,
);

export const FAINTEST_VISIBLE_INK =
	0.5 + ((1 / STRONG_TO_FAINT.length) ** (1 / GAMMA) - 0.5) / CONTRAST;

export function glyphFor(ink: number): string {
	const faintness = 1 - toneCurve(ink);
	const index = Math.min(
		Math.floor(faintness * STRONG_TO_FAINT.length),
		STRONG_TO_FAINT.length - 1,
	);
	return STRONG_TO_FAINT[index] ?? BLANK;
}

function toneCurve(ink: number): number {
	return clampUnit((clampUnit(ink) - 0.5) * CONTRAST + 0.5) ** GAMMA;
}

function clampUnit(value: number): number {
	return Math.min(Math.max(value, 0), 1);
}
