import { useSyncExternalStore } from "react";
import { TREE_POSITION } from "#/lib/storage/settings.ts";
import type { TreePosition } from "#/lib/tree/position.ts";
import { sidebar } from "#/lib/tree/sidebar.ts";

export function usePanelPosition(): TreePosition {
	return useSyncExternalStore(
		sidebar.subscribe,
		sidebar.position,
		() => TREE_POSITION.fallback,
	);
}
