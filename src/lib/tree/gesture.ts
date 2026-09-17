import { MAX_TREE_WIDTH, MIN_TREE_WIDTH } from "./prefs.ts";

/**
 * Dragging the sidebar's edge past its minimum does not stop it: the panel
 * holds its minimum width and slides out of the window instead, fading and
 * blurring the further it goes. Letting go anywhere out there snaps it shut —
 * once the panel has started to leave, there is no narrower width for it to
 * stop at. Let go at or above the minimum and it is simply a resize.
 */

/** How far past the minimum the panel has faded out completely. */
const FADE_DISTANCE = 160;
/** How blurred the panel is by the time its edge reaches the window's. */
const MAX_BLUR = 2;

export interface DragFrame {
	/** The width the panel's box takes, which the content no longer follows. */
	width: number;
	opacity: number;
	/** In pixels. */
	blur: number;
	/** Whether letting go here snaps the panel shut. */
	collapses: boolean;
}

/** What the panel looks like with its edge dragged to `width`. */
export function dragFrame(width: number): DragFrame {
	const overshoot = Math.max(0, MIN_TREE_WIDTH - width);

	return {
		width: Math.min(MAX_TREE_WIDTH, Math.max(0, width)),
		opacity: Math.max(0, 1 - overshoot / FADE_DISTANCE),
		blur: (Math.min(overshoot, MIN_TREE_WIDTH) / MIN_TREE_WIDTH) * MAX_BLUR,
		collapses: overshoot > 0,
	};
}
