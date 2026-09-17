import { useEffect, useRef } from "react";

/**
 * A single unmodified key, pressed anywhere on the page other than while
 * typing, calls `onPress` — and is not typed anywhere itself. A key pressed in
 * a field is text, not a command, so the field keeps it.
 */
export function useKeyShortcut(key: string, onPress: () => void) {
	// The latest callback without re-subscribing on every render.
	const handler = useRef(onPress);
	handler.current = onPress;

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (event.key.toLowerCase() !== key) return;
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			if (isEditable(event.target)) return;
			event.preventDefault();
			handler.current();
		}

		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [key]);
}

function isEditable(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;

	return (
		target.isContentEditable ||
		target.matches("input, textarea, select, [role='combobox']")
	);
}
