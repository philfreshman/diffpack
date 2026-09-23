import type { TreeView } from "./visibility.ts";

/**
 * The folders the user has opened or closed by hand, and the comparison they
 * were chosen in, held as one: a folder chosen in one comparison means nothing
 * in the next.
 */
export interface FolderState
	extends Pick<TreeView, "expandedKeys" | "collapsedKeys"> {
	comparison: string;
}

/** What changes which folders count as chosen by hand. */
export type FolderAction =
	/** A folder opened (`true`) or shut (`false`) by hand. */
	| { kind: "toggle"; path: string; expanded: boolean }
	/** The filter or only-modified changed what the tree holds. */
	| { kind: "narrow" }
	/** Another comparison is on screen. */
	| { kind: "reset"; comparison: string };

const NONE: ReadonlySet<string> = new Set();

/**
 * A comparison as it opens: nothing chosen by hand, so the tree opens only
 * what it opens by itself — the way to a filter's matches, and a package's
 * only folder.
 */
export function foldersFor(comparison: string): FolderState {
	return { comparison, expandedKeys: NONE, collapsedKeys: NONE };
}

/**
 * The rules for the folders chosen by hand, as one reducer: the panel holds
 * the state and says what happened, and what that does to the state is
 * answered here, where a test can ask without a DOM.
 */
export function folderReducer(
	state: FolderState,
	action: FolderAction,
): FolderState {
	switch (action.kind) {
		// Opening or closing a folder is a choice, and it outranks
		// auto-expansion: a folder is in one set or the other, never both.
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
		// Narrowing the tree clears the folders closed by hand: they were closed
		// against a fuller tree, and holding them shut would hide the very rows
		// the user just asked to see.
		case "narrow":
			return { ...state, collapsedKeys: NONE };
		// Another comparison is other folders, and none of them chosen yet.
		// Carried over, a folder opened in the last one would stop this one's
		// only folder opening itself, and one shut there would stay shut here.
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
