import { type RefObject, useEffect } from "react";

/**
 * A split row holds both sides, so a drag down it would select both. The side
 * pressed in is marked on the scroller, and SplitDiffRow takes the other one out
 * of the selection until the next press. Written to the DOM, not state: no re-render.
 */
export function useOneSidedSelection(
	scroller: RefObject<HTMLElement | null>,
): void {
	useEffect(() => {
		const element = scroller.current;
		if (!element) return;

		function onMouseDown(event: MouseEvent) {
			if (!element || !(event.target instanceof Element)) return;
			const half = event.target.closest<HTMLElement>("[data-side]");

			if (half?.dataset.side) element.dataset.selecting = half.dataset.side;
			else delete element.dataset.selecting;
		}

		element.addEventListener("mousedown", onMouseDown);

		return () => element.removeEventListener("mousedown", onMouseDown);
	}, [scroller]);
}
