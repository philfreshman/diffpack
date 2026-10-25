import { useSyncExternalStore } from "react";

function subscribeToNothing(): () => void {
	return () => {};
}

export function useHydrated(): boolean {
	return useSyncExternalStore(
		subscribeToNothing,
		() => true,
		() => false,
	);
}
