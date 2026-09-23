import type { TreeView } from "./visibility.ts";

/** The folders the user has opened or closed by hand. */
export type FolderState = Pick<TreeView, "expandedKeys" | "collapsedKeys">;

/** What changes which folders count as chosen by hand. */
export type FolderAction =
	/** A folder opened (`true`) or shut (`false`) by hand. */
	| { kind: "toggle"; path: string; expanded: boolean }
	/** The filter or only-modified changed what the tree holds. */
	| { kind: "narrow" };

const NONE: ReadonlySet<string> = new Set();

/**
 * Nothing chosen by hand, so the tree opens only what it opens by itself: the
 * way to a filter's matches, and a package's only folder.
 */
export const NO_FOLDERS_CHOSEN: FolderState = {
	expandedKeys: NONE,
	collapsedKeys: NONE,
};

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
