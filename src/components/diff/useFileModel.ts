import { type RefObject, useCallback, useMemo, useRef, useState } from "react";
import type { Expander } from "#/lib/diff/computeVisibility.ts";
import { type FileModel, fileModel, parseFile } from "#/lib/diff/fileModel.ts";
import {
	emptyMemory,
	fileView,
	type ViewMemory,
	withExpandAll,
	withRevealed,
	withScrollTop,
} from "#/lib/diff/viewMemory.ts";
import type { OpenFile } from "#/lib/session/diffSession.ts";
import { type ShownFile, shownFile } from "#/lib/session/shownFile.ts";

/**
 * The viewer's scroller, as rows: all the model needs of the view to step
 * through the differences. Which row to go to is the model's to work out; the
 * view only knows where its rows are on screen.
 */
export interface DiffViewHandle {
	/** The row at the top of the viewport: where the reader is. */
	topRow(): number;
	/** Scrolls until row `index` is at the top of the viewport. */
	scrollToRow(index: number): void;
}

/** The file on screen, and what the toolbar and the viewer can do to it. */
export interface FileModelControls extends FileModel {
	/** Scrolls to the next difference down (`1`) or up (`-1`). */
	stepDifference(direction: 1 | -1): void;
	/** Opens the whole file, or folds it back to how it arrived. */
	setExpandAll(expandAll: boolean): void;
	/** A fold opened: the expander carries the lines it offered. */
	reveal(expander: Expander): void;
	/** Where the file was left, on the way out. */
	rememberScroll(scrollTop: number): void;
	/** Where the viewer attaches its scroller, for the arrows to move. */
	viewport: RefObject<DiffViewHandle | null>;
}

/**
 * The file on screen as one model, which the toolbar and the viewer both read:
 * parsed once, laid out for the view the reader has chosen, and its count and
 * its arrows taken from the same rows. `null` while there is no file on screen.
 *
 * It is held above the viewer rather than in it: the viewer is mounted per
 * file, and what has been opened in each file is exactly what has to outlive
 * that.
 */
export function useFileModel(
	comparisonKey: string | null,
	open: OpenFile | null,
	split: boolean,
): FileModelControls | null {
	const shown = useShownFile(open);
	const { view, reveal, setExpandAll, rememberScroll } = useFileMemory(
		comparisonKey,
		shown?.path ?? "",
	);
	const viewport = useRef<DiffViewHandle>(null);

	const file = useMemo(
		() => shown && parseFile(shown.path, shown.diff),
		[shown],
	);
	const model = useMemo(
		() => file && fileModel(file, view, split),
		[file, view, split],
	);

	const stepDifference = useCallback(
		(direction: 1 | -1) => {
			const at = viewport.current;
			if (!at || !model) return;

			// From the row at the top of the viewport, so "next" is the next
			// difference the reader has not reached rather than the one already
			// under their eyes.
			const next = model.nextDifference(at.topRow(), direction);
			if (next !== undefined) at.scrollToRow(next);
		},
		[model],
	);

	return useMemo(
		() =>
			model && {
				...model,
				stepDifference,
				setExpandAll,
				reveal,
				rememberScroll,
				viewport,
			},
		[model, stepDifference, setExpandAll, reveal, rememberScroll],
	);
}

/**
 * The file on screen, which is not always the file last asked for — see
 * `shownFile`. It is state adjusted during render rather than in an effect,
 * which would show the empty pane for a frame first.
 */
function useShownFile(open: OpenFile | null): ShownFile | null {
	const [shown, setShown] = useState<ShownFile | null>(null);
	const next = shownFile(shown, open);
	if (next?.diff !== shown?.diff) setShown(next);

	return shown;
}

/**
 * How much of each file is open, and where each was left. The memory is one
 * comparison's: a new pair of versions is a new set of files, and what had
 * been opened in the old ones means nothing in them.
 */
function useFileMemory(comparisonKey: string | null, path: string) {
	// The memory and the comparison it belongs to, held as one.
	const [held, setHeld] = useState(() => ({
		comparisonKey,
		memory: emptyMemory(),
	}));
	// Dropping the memory as the comparison changes is an adjustment to a prop,
	// not a side effect of one: doing it in an effect would leave one render
	// showing the previous comparison's folds against this comparison's files.
	if (held.comparisonKey !== comparisonKey) {
		setHeld({ comparisonKey, memory: emptyMemory() });
	}

	// A change lands only in the comparison it was made in. The viewer hands
	// its scroll back as it unmounts, which is after the comparison has moved
	// on: let into the new memory, it would open the file there partway down,
	// at a place that meant something only in the old one.
	const change = useCallback(
		(update: (memory: ViewMemory) => ViewMemory) =>
			setHeld((it) =>
				it.comparisonKey === comparisonKey
					? { comparisonKey, memory: update(it.memory) }
					: it,
			),
		[comparisonKey],
	);

	return {
		view: fileView(held.memory, path),
		reveal: useCallback(
			(expander: Expander) => change((it) => withRevealed(it, path, expander)),
			[change, path],
		),
		setExpandAll: useCallback(
			(expandAll: boolean) =>
				change((it) => withExpandAll(it, path, expandAll)),
			[change, path],
		),
		rememberScroll: useCallback(
			(scrollTop: number) => change((it) => withScrollTop(it, path, scrollTop)),
			[change, path],
		),
	};
}
