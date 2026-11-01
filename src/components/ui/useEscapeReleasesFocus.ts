import { useEffect } from "react";
import { blurActiveElement } from "./blurActiveElement.ts";

const RELEASE = "Escape";

export function useEscapeReleasesFocus() {
	useEffect(() => {
		let releasing = false;

		function onKeyDown(event: KeyboardEvent) {
			releasing = event.key === RELEASE;
			if (releasing) setTimeout(blurActiveElement);
		}

		function onPointerDown() {
			releasing = false;
		}

		function onFocusIn(event: FocusEvent) {
			if (!releasing || !(event.target instanceof HTMLElement)) return;
			releasing = false;
			event.target.blur();
		}

		document.addEventListener("keydown", onKeyDown, true);
		document.addEventListener("pointerdown", onPointerDown, true);
		document.addEventListener("focusin", onFocusIn, true);
		return () => {
			document.removeEventListener("keydown", onKeyDown, true);
			document.removeEventListener("pointerdown", onPointerDown, true);
			document.removeEventListener("focusin", onFocusIn, true);
		};
	}, []);
}
