import { useVirtualizer } from "@tanstack/react-virtual";
import type { RefObject } from "react";
import { useImperativeHandle } from "react";
import type { FileModelControls } from "#/components/diff/useFileModel.ts";

/** Must match `--diff-line-height` in pixels. */
const ROW_HEIGHT = 23;

export function useRowVirtualizer(
	file: Pick<FileModelControls, "rows" | "scrollTop" | "viewport">,
	scrollerRef: RefObject<HTMLDivElement | null>,
) {
	"use no memo";

	// oxlint-disable-next-line react/incompatible-library -- skipped by "use no memo": the virtualizer changes without a new identity
	const virtualizer = useVirtualizer({
		count: file.rows.length,
		getScrollElement: () => scrollerRef.current,
		estimateSize: () => ROW_HEIGHT,
		overscan: 16,
		// Restoring by hand after mount would draw the top of the file, then jump.
		initialOffset: file.scrollTop,
	});

	useImperativeHandle(
		file.viewport,
		() => ({
			topRow() {
				const top = scrollerRef.current?.scrollTop ?? 0;
				return virtualizer.getVirtualItemForOffset(top)?.index ?? 0;
			},
			scrollToRow(index) {
				virtualizer.scrollToIndex(index, { align: "start" });
			},
		}),
		[virtualizer, scrollerRef],
	);

	return virtualizer;
}
