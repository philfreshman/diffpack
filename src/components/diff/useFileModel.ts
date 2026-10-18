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

export interface DiffViewHandle {
	topRow(): number;
	scrollToRow(index: number): void;
}

export interface FileModelControls extends FileModel {
	stepDifference(direction: 1 | -1): void;
	setExpandAll(expandAll: boolean): void;
	reveal(expander: Expander): void;
	rememberScroll(scrollTop: number): void;
	viewport: RefObject<DiffViewHandle | null>;
}

/** Lives above the viewer, which mounts per file; each file's folds must outlive it. */
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

/** Adjusted during render, not in an effect, which would flash an empty pane. */
function useShownFile(open: OpenFile | null): ShownFile | null {
	const [shown, setShown] = useState<ShownFile | null>(null);
	const next = shownFile(shown, open);
	if (next?.diff !== shown?.diff) setShown(next);

	return shown;
}

function useFileMemory(comparisonKey: string | null, path: string) {
	const [held, setHeld] = useState(() => ({
		comparisonKey,
		memory: emptyMemory(),
	}));
	// Reset during render: an effect would show one render of the old comparison's folds.
	if (held.comparisonKey !== comparisonKey) {
		setHeld({ comparisonKey, memory: emptyMemory() });
	}

	// The viewer reports its scroll on unmount, after the comparison may have moved on.
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
