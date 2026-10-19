import { TREE_WIDTH } from "#/lib/storage/settings.ts";

// Dragged past its minimum, the panel slides out and fades instead of
// narrowing; letting go anywhere out there snaps it shut.

const FADE_DISTANCE = 160;
const MAX_BLUR = 2;

export interface DragFrame {
	width: number;
	opacity: number;
	/** In pixels. */
	blur: number;
	collapses: boolean;
}

export function dragFrame(width: number): DragFrame {
	const overshoot = Math.max(0, TREE_WIDTH.min - width);

	return {
		width: Math.min(TREE_WIDTH.max, Math.max(0, width)),
		opacity: Math.max(0, 1 - overshoot / FADE_DISTANCE),
		blur: (Math.min(overshoot, TREE_WIDTH.min) / TREE_WIDTH.min) * MAX_BLUR,
		collapses: overshoot > 0,
	};
}
