import { type RefObject, useSyncExternalStore } from "react";
import { TREE_WIDTH } from "#/lib/storage/settings.ts";
import { edgeAfterDrag, nudgedWidth } from "#/lib/tree/gesture.ts";
import { sidebar } from "#/lib/tree/sidebar.ts";
import { usePanelPosition } from "./usePanelPosition.ts";

/** The sidebar applies `dragFrame` to the page; the content's fade is done here, on the panel's own element. */
export function usePanelResize(
	panelRef: RefObject<HTMLElement | null>,
	contentRef: RefObject<HTMLElement | null>,
) {
	const width = useSyncExternalStore(
		sidebar.subscribe,
		sidebar.width,
		() => TREE_WIDTH.fallback,
	);
	const position = usePanelPosition();

	function fade(opacity: number, blur: number) {
		const element = contentRef.current;
		if (!element) return;
		element.style.opacity = opacity < 1 ? String(opacity) : "";
		element.style.filter = blur > 0 ? `blur(${blur}px)` : "";
	}

	function startResize(event: React.PointerEvent<HTMLElement>) {
		event.preventDefault();
		const startX = event.clientX;
		const startWidth =
			panelRef.current?.getBoundingClientRect().width ?? sidebar.width();
		let edge = startWidth;
		sidebar.startDrag();

		function onMove(move: PointerEvent) {
			edge = edgeAfterDrag({
				startWidth,
				travel: move.clientX - startX,
				position,
			});
			const frame = sidebar.dragTo(edge);
			fade(frame.opacity, frame.blur);
		}

		function onUp() {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			window.removeEventListener("pointercancel", onUp);
			sidebar.endDrag(edge);
			// Cleared in the same frame the snap styles arrive, so the transition runs on from here.
			fade(1, 0);
		}

		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		window.addEventListener("pointercancel", onUp);
	}

	function nudge(event: React.KeyboardEvent<HTMLElement>) {
		const next = nudgedWidth(sidebar.width(), event.key, position);
		if (next === null) return;
		event.preventDefault();
		sidebar.resize(next);
	}

	return { width, startResize, nudge };
}
