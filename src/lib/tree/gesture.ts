import { TREE_WIDTH } from "#/lib/storage/settings.ts";
import type { TreePosition } from "./position.ts";

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

const NUDGE_STEP = 16;

const NUDGE_TRAVEL: Partial<Record<string, number>> = {
	ArrowRight: NUDGE_STEP,
	ArrowLeft: -NUDGE_STEP,
};

const WIDENING_DIRECTION: Record<TreePosition, 1 | -1> = {
	left: 1,
	right: -1,
};

export function edgeAfterDrag({
	startWidth,
	travel,
	position,
}: {
	startWidth: number;
	travel: number;
	position: TreePosition;
}): number {
	return startWidth + travel * WIDENING_DIRECTION[position];
}

export function nudgedWidth(
	width: number,
	key: string,
	position: TreePosition,
): number | null {
	const travel = NUDGE_TRAVEL[key];
	if (travel === undefined) return null;

	return edgeAfterDrag({ startWidth: width, travel, position });
}
