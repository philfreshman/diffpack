import type { TreeView } from "./visibility.ts";

export interface FolderState extends Pick<
	TreeView,
	"expandedKeys" | "collapsedKeys"
> {
	comparison: string;
}

export type FolderAction =
	| { kind: "toggle"; path: string; expanded: boolean }
	/** The filter or only-modified changed. */
	| { kind: "narrow" }
	| { kind: "reset"; comparison: string };

const NONE: ReadonlySet<string> = new Set();

export function foldersFor(comparison: string): FolderState {
	return { comparison, expandedKeys: NONE, collapsedKeys: NONE };
}

export function folderReducer(
	state: FolderState,
	action: FolderAction,
): FolderState {
	switch (action.kind) {
		// A folder is in one set or the other, never both.
		case "toggle":
			return {
				...state,
				expandedKeys: withKey(state.expandedKeys, action.path, action.expanded),
				collapsedKeys: withKey(
					state.collapsedKeys,
					action.path,
					!action.expanded,
				),
			};
		// Folders shut against a fuller tree would hide the rows just asked for.
		case "narrow":
			return { ...state, collapsedKeys: NONE };
		case "reset":
			return foldersFor(action.comparison);
	}
}

function withKey(
	keys: ReadonlySet<string>,
	path: string,
	present: boolean,
): ReadonlySet<string> {
	const next = new Set(keys);
	if (present) next.add(path);
	else next.delete(path);

	return next;
}
