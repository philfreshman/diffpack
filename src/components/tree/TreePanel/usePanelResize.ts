import { type RefObject, useEffect, useState } from "react";
import { dragFrame } from "#/lib/tree/gesture.ts";
import {
	applyTreeWidth,
	clampTreeWidth,
	DEFAULT_TREE_WIDTH,
	readTreeWidth,
	toggleTreeCollapsed,
	writeTreeWidth,
} from "#/lib/tree/prefs.ts";

/** On `<html>` for the length of a drag: the stylesheet stands the edge's button down. */
const DRAGGING_ATTRIBUTE = "data-tree-dragging";
/** On `<html>` while the panel animates shut; the stylesheet does the animating. */
const SNAPPING_ATTRIBUTE = "data-tree-snapping";
/** How long that takes — `--duration-fast`, which the stylesheet transitions over. */
const SNAP_MS = 150;

/**
 * The panel's edge: dragged, or nudged from the keyboard.
 *
 * A drag within limits sets the width. Past the minimum the panel's box keeps
 * following the pointer while its content holds the minimum and slides out of
 * the window, fading and blurring — and let go anywhere out there, it snaps
 * the rest of the way shut on its own. `dragFrame` is the rule; this applies
 * it.
 *
 * The width is a custom property on `<html>`, written before paint and
 * rewritten by the drag; keeping it out of React state is what stops the panel
 * flashing at its default width on every load. The state copy exists only so
 * the handle can announce where it is.
 */
export function usePanelResize(
	panel: RefObject<HTMLElement | null>,
	content: RefObject<HTMLElement | null>,
) {
	const [width, setWidth] = useState(DEFAULT_TREE_WIDTH);
	useEffect(() => setWidth(readTreeWidth()), []);

	function resizeTo(next: number) {
		const clamped = clampTreeWidth(next);
		applyTreeWidth(document, clamped);
		setWidth(clamped);

		return clamped;
	}

	/** One frame of the drag, which is not yet a width anyone chose. */
	function follow(next: number) {
		const frame = dragFrame(next);
		applyTreeWidth(document, frame.width);
		const style = content.current?.style;
		if (!style) return;
		style.opacity = frame.opacity < 1 ? String(frame.opacity) : "";
		style.filter = frame.blur > 0 ? `blur(${frame.blur}px)` : "";
	}

	function startResize(event: React.PointerEvent<HTMLElement>) {
		event.preventDefault();
		const startX = event.clientX;
		const startWidth = panel.current?.getBoundingClientRect().width ?? width;
		let last = startWidth;
		const root = document.documentElement;
		root.setAttribute(DRAGGING_ATTRIBUTE, "");

		function onMove(move: PointerEvent) {
			last = startWidth + move.clientX - startX;
			follow(last);
		}

		function onUp() {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			window.removeEventListener("pointercancel", onUp);
			root.removeAttribute(DRAGGING_ATTRIBUTE);

			if (dragFrame(last).collapses) {
				snapShut(startWidth);
				return;
			}
			writeTreeWidth(resizeTo(last));
		}

		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		window.addEventListener("pointercancel", onUp);
	}

	/**
	 * Animates the panel out, then shuts it at the width it had before the drag:
	 * reopening should give back the panel that was there, not the sliver it was
	 * dragged down to.
	 */
	function snapShut(restoreWidth: number) {
		const root = document.documentElement;
		// The stylesheet takes over from where the drag left the content: the
		// inline fade and blur go in the same frame the snap's own arrive, so
		// the transition runs on from them rather than jumping back first.
		root.setAttribute(SNAPPING_ATTRIBUTE, "");
		content.current?.style.removeProperty("opacity");
		content.current?.style.removeProperty("filter");
		window.setTimeout(() => {
			resizeTo(restoreWidth);
			toggleTreeCollapsed(document);
			root.removeAttribute(SNAPPING_ATTRIBUTE);
		}, SNAP_MS);
	}

	/** The same resize, for anyone who is not holding a mouse. */
	function nudge(event: React.KeyboardEvent<HTMLElement>) {
		const step =
			event.key === "ArrowRight" ? 16 : event.key === "ArrowLeft" ? -16 : 0;
		if (!step) return;
		event.preventDefault();
		writeTreeWidth(resizeTo(width + step));
	}

	return { width, startResize, nudge };
}
