import { useMemo, useReducer, useState } from "react";
import { useSetting } from "#/components/storage/useSetting.ts";
import { HIDE_VIEWED, ONLY_MODIFIED } from "#/lib/storage/settings.ts";
import { folderReducer, foldersFor } from "#/lib/tree/folders.ts";
import { visibleRows } from "#/lib/tree/visibility.ts";
import type { DiffFileEntry } from "#/lib/worker/protocol.ts";

const NOTHING_HIDDEN: ReadonlySet<string> = new Set();

export function useTreeRows(
	tree: DiffFileEntry | null,
	comparison: string,
	viewedPaths: ReadonlySet<string> | undefined,
) {
	const [filter, setFilter] = useState("");
	const { value: onlyModified, set: setOnlyModified } =
		useSetting(ONLY_MODIFIED);
	const { value: hideViewed, set: setHideViewed } = useSetting(HIDE_VIEWED);
	const hiddenPaths = (hideViewed && viewedPaths) || NOTHING_HIDDEN;

	const [folders, dispatch] = useReducer(folderReducer, comparison, foldersFor);
	// Reset during render: an effect would render once with the old comparison's folders.
	if (folders.comparison !== comparison)
		dispatch({ kind: "reset", comparison });
	const { expandedKeys, collapsedKeys } = folders;

	const rows = useMemo(
		() =>
			visibleRows(tree, {
				filter,
				onlyModified,
				hiddenPaths,
				expandedKeys,
				collapsedKeys,
			}),
		[tree, filter, onlyModified, hiddenPaths, expandedKeys, collapsedKeys],
	);

	function narrow(change: () => void) {
		dispatch({ kind: "narrow" });
		change();
	}

	return {
		rows,
		filter,
		onlyModified,
		hideViewed,
		setHideViewed,
		changeFilter: (next: string) => narrow(() => setFilter(next)),
		changeOnlyModified: (next: boolean) => narrow(() => setOnlyModified(next)),
		toggleFolder(path: string, expanded: boolean) {
			dispatch({ kind: "toggle", path, expanded });
		},
	};
}
