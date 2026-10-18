import { type RefObject, useSyncExternalStore } from "react";
import { TREE_WIDTH } from "#/lib/storage/settings.ts";
import { sidebar } from "#/lib/tree/sidebar.ts";

/** The sidebar applies `dragFrame` to the page; the content's fade is done here, on the panel's own element. */
export function usePanelResize(
	panel: RefObject<HTMLElement | null>,
	content: RefObject<HTMLElement | null>,
) {
	const width = useSyncExternalStore(
		sidebar.subscribe,
		sidebar.width,
		() => TREE_WIDTH.fallback,
	);

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
			// Cleared in the same frame the snap styles arrive, so the transition runs on from here.
			fade(1, 0);
		}

		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		window.addEventListener("pointercancel", onUp);
	}

	function nudge(event: React.KeyboardEvent<HTMLElement>) {
		const step =
			event.key === "ArrowRight" ? 16 : event.key === "ArrowLeft" ? -16 : 0;
		if (!step) return;
		event.preventDefault();
		sidebar.resize(sidebar.width() + step);
	}

	return { width, startResize, nudge };
}
