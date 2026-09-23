import { type RefObject, useSyncExternalStore } from "react";
import { TREE_WIDTH } from "#/lib/storage/settings.ts";
import { sidebar } from "#/lib/tree/sidebar.ts";

/**
 * The panel's edge: dragged, or nudged from the keyboard.
 *
 * A drag within limits sets the width. Past the minimum the panel's box keeps
 * following the pointer while its content holds the minimum and slides out of
 * the window, fading and blurring — and let go anywhere out there, it snaps
 * the rest of the way shut on its own. `dragFrame` is the rule and the sidebar
 * applies it to the page; this turns the pointer and the keys into the
 * sidebar's calls, and fades the content, which is the panel's own element
 * rather than the page's.
 *
 * The width the handle announces is the sidebar's, read the way React reads
 * any store outside it: the default on the server and in the first client
 * render, which must agree, and the chosen width once mounted.
 */
export function usePanelResize(
	panel: RefObject<HTMLElement | null>,
	content: RefObject<HTMLElement | null>,
) {
	const width = useSyncExternalStore(
		sidebar.subscribe,
		sidebar.width,
		() => TREE_WIDTH.fallback,
	);

	/**
	 * Fades and blurs the content inline, as far as the drag has taken it;
	 * fully opaque and sharp clears both, handing it back to the stylesheet.
	 */
	function fade(opacity: number, blur: number) {
		const style = content.current?.style;
		if (!style) return;
		style.opacity = opacity < 1 ? String(opacity) : "";
		style.filter = blur > 0 ? `blur(${blur}px)` : "";
	}

	function startResize(event: React.PointerEvent<HTMLElement>) {
		event.preventDefault();
		const startX = event.clientX;
		const startWidth =
			panel.current?.getBoundingClientRect().width ?? sidebar.width();
		let edge = startWidth;
		sidebar.startDrag();

		function onMove(move: PointerEvent) {
			edge = startWidth + move.clientX - startX;
			const frame = sidebar.dragTo(edge);
			fade(frame.opacity, frame.blur);
		}

		function onUp() {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			window.removeEventListener("pointercancel", onUp);
			sidebar.endDrag(edge);
			// Let go past the minimum, the stylesheet takes over from where the
			// drag left the content: the inline fade and blur go in the same
			// frame the snap's own arrive, so the transition runs on from them
			// rather than jumping back first.
			fade(1, 0);
		}

		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		window.addEventListener("pointercancel", onUp);
	}

	/** The same resize, for anyone who is not holding a mouse. */
	function nudge(event: React.KeyboardEvent<HTMLElement>) {
		const step =
			event.key === "ArrowRight" ? 16 : event.key === "ArrowLeft" ? -16 : 0;
		if (!step) return;
		event.preventDefault();
		sidebar.resize(sidebar.width() + step);
	}

	return { width, startResize, nudge };
}
