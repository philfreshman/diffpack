import { useCallback, useState } from "react";
import { useSetting } from "#/components/storage/useSetting.ts";
import type { Expander } from "#/lib/diff/computeVisibility.ts";
import {
	emptyMemory,
	type FileView,
	fileView,
	withExpandAll,
	withRevealed,
	withScrollTop,
} from "#/lib/diff/viewMemory.ts";
import { SPLIT_VIEW } from "#/lib/storage/settings.ts";

export interface DiffViewControls {
	view: FileView;
	split: boolean;
	setSplit(split: boolean): void;
	reveal(expander: Expander): void;
	setExpandAll(expandAll: boolean): void;
	rememberScroll(scrollTop: number): void;
}

/**
 * How much of each file is open, and which of the two layouts they are shown
 * in — held above the viewer, because the viewer is mounted per file and this
 * is exactly what has to outlive that.
 *
 * The memory is one comparison's: a new pair of versions is a new set of
 * files, and what had been opened in the old ones means nothing in them.
 */
export function useDiffView(
	comparisonKey: string | null,
	path: string,
): DiffViewControls {
	const [memory, setMemory] = useState(emptyMemory);
	// Dropping the memory as the comparison changes is an adjustment to a prop,
	// not a side effect of one: doing it in an effect would leave one render
	// showing the previous comparison's folds against this comparison's files.
	const [remembering, setRemembering] = useState(comparisonKey);
	if (remembering !== comparisonKey) {
		setRemembering(comparisonKey);
		setMemory(emptyMemory());
	}

	// The toolbar's toggle stores the layout as it flips it: which one a diff is
	// read in is a habit, not a decision to make again per file.
	const split = useSetting(SPLIT_VIEW);

	return {
		view: fileView(memory, path),
		split: split.value,
		setSplit: split.set,
		reveal: useCallback(
			(expander: Expander) =>
				setMemory((it) => withRevealed(it, path, expander)),
			[path],
		),
		setExpandAll: useCallback(
			(expandAll: boolean) =>
				setMemory((it) => withExpandAll(it, path, expandAll)),
			[path],
		),
		rememberScroll: useCallback(
			(scrollTop: number) =>
				setMemory((it) => withScrollTop(it, path, scrollTop)),
			[path],
		),
	};
}
