import { useEffect, useRef } from "react";

export function useKeyShortcut(key: string, onPress: () => void) {
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
