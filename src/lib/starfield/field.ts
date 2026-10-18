export interface DiffMark {
	x: number;
	y: number;
	z: number;
	size: number;
	periodMs: number;
	phase: number;
	plus: boolean;
}

/** The shader wraps marks within this cube, and the far fade hides the seam. */
export const FIELD_HALF = 38;
export const MARK_COUNT = 6500;
export const FIELD_SEED = 0x5eed;

const PLUS_SHARE = 0.62;
const MIN_SIZE = 0.55;
const MAX_SIZE = 1.65;
const MIN_PERIOD_MS = 2000;
const MAX_PERIOD_MS = 6000;

/** Mulberry32. Seeded so a seed gives the same sky twice, which hydration relies on. */
export function createRng(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function between(rng: () => number, min: number, max: number): number {
	return min + rng() * (max - min);
}

export function generateMarks(count: number, rng: () => number): DiffMark[] {
	return Array.from({ length: count }, () => ({
		x: between(rng, -FIELD_HALF, FIELD_HALF),
		y: between(rng, -FIELD_HALF, FIELD_HALF),
		z: between(rng, -FIELD_HALF, FIELD_HALF),
		size: between(rng, MIN_SIZE, MAX_SIZE),
		periodMs: between(rng, MIN_PERIOD_MS, MAX_PERIOD_MS),
		phase: rng(),
		plus: rng() < PLUS_SHARE,
	}));
}
