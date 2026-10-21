import type { Virtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef } from "react";
import type { FileModelControls } from "#/components/diff/useFileModel.ts";
import {
	anchoredLineIndex,
	anchoredRowIndex,
	type LineAnchor,
	rangeAroundLine,
} from "#/lib/diff/lineAnchor.ts";

type Rows = FileModelControls["rows"];

interface Seek {
	anchor: LineAnchor;
	revealedFrom: Rows | null;
	done: boolean;
}

export function useAnchorSeek(
	file: Pick<FileModelControls, "rows" | "lines" | "reveal">,
	anchor: LineAnchor | null,
	virtualizer: Virtualizer<HTMLDivElement, Element>,
): void {
	const seek = useRef<Seek | null>(null);
	const { rows, lines, reveal } = file;

	useEffect(() => {
		if (!anchor) return;
		if (seek.current?.anchor !== anchor) {
			seek.current = { anchor, revealedFrom: null, done: false };
		}
		const current = seek.current;
		if (current.done || current.revealedFrom === rows) return;

		const row = anchoredRowIndex(rows, anchor);
		if (row !== -1) {
			const frame = requestAnimationFrame(() => {
				current.done = true;
				if (!isOnScreen(virtualizer, row)) {
					virtualizer.scrollToIndex(row, { align: "center" });
				}
			});
			return () => cancelAnimationFrame(frame);
		}

		const line = anchoredLineIndex(lines, anchor);
		if (line === -1 || current.revealedFrom) {
			current.done = true;
			return;
		}
		current.revealedFrom = rows;
		reveal(rangeAroundLine(line));
	}, [anchor, rows, lines, reveal, virtualizer]);
}

function isOnScreen(
	virtualizer: Virtualizer<HTMLDivElement, Element>,
	row: number,
): boolean {
	const range = virtualizer.range;
	return range !== null && row >= range.startIndex && row <= range.endIndex;
}
