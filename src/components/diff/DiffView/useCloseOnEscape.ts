import { useEffect, useEffectEvent } from "react";

/** On the document because the viewer lacks focus; a field keeps its own Escape. */
export function useCloseOnEscape(onClose: () => void): void {
	const close = useEffectEvent(onClose);

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (event.key !== "Escape" || isField(event.target)) return;
			event.preventDefault();
			close();
		}

		document.addEventListener("keydown", onKeyDown);

		return () => document.removeEventListener("keydown", onKeyDown);
	}, []);
}

function isField(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;

	return (
		target.isContentEditable ||
		["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
	);
}
