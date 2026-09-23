import { useVirtualizer } from "@tanstack/react-virtual";
import type { CSSProperties } from "react";
import { useImperativeHandle, useRef } from "react";
import { CollapsedRow } from "#/components/diff/CollapsedRow/CollapsedRow.tsx";
import { DiffRow } from "#/components/diff/DiffRow/DiffRow.tsx";
import { DiffScrollbar } from "#/components/diff/DiffScrollbar/DiffScrollbar.tsx";
import { SplitDiffRow } from "#/components/diff/SplitDiffRow/SplitDiffRow.tsx";
import type { FileModelControls } from "#/components/diff/useFileModel.ts";
import { gutterChars } from "#/lib/diff/gutter.ts";
import type { HighlightAppearance } from "#/lib/diff/highlightThemes.ts";
import styles from "./DiffView.module.css";
import { useCloseOnEscape } from "./useCloseOnEscape.ts";
import { useScrollMemory } from "./useScrollMemory.ts";

export interface DiffViewProps {
	/** The file on screen: the rows to draw, and what can be done to them. */
	file: FileModelControls;
	/** Escape: back to the comparison, with no file open. */
	onClose(): void;
	/**
	 * Another file has been asked for and this one is what is still on screen
	 * until it arrives.
	 */
	pending?: boolean;
	/**
	 * The ground the syntax theme paints on, or `null` before it has been read.
	 * Everything the viewer colours itself follows this rather than the page
	 * theme — see `data-syntax` below.
	 */
	syntax: HighlightAppearance | null;
}

/**
 * `--diff-line-height` in pixels: what an unwrapped row measures, and the
 * guess the virtualiser starts every row from.
 */
const ROW_HEIGHT = 24;

/**
 * The file, rendered.
 *
 * Everything it draws comes from the file model — the lines, the folds and
 * the differences among them are all worked out before a row exists, in
 * `useFileModel` — so this component is only ever about putting rows on
 * screen, measuring them and keeping the scroll where the reader left it.
 */
export function DiffView({ file, onClose, pending, syntax }: DiffViewProps) {
	const { path, lines, language, rows } = file;

	const scroller = useRef<HTMLDivElement>(null);
	const virtualizer = useVirtualizer({
		count: rows.length,
		getScrollElement: () => scroller.current,
		// Rows wrap, so the estimate is only a starting point; each rendered row
		// measures itself and the total height corrects.
		estimateSize: () => ROW_HEIGHT,
		overscan: 16,
		// Where the file was left. The virtualiser scrolls there itself on mount
		// — it is also what decides which rows to draw first, so restoring the
		// position by hand afterwards would draw the top of the file and then
		// jump.
		initialOffset: file.scrollTop,
	});

	// How tall the file is — and, as a side effect of asking, the virtualiser's
	// measurements brought up to date. The scrollbar places the model's
	// changes by those, so they are handed to it along with the model.
	const height = virtualizer.getTotalSize();

	// Stepping through the differences is the toolbar's button and the viewer's
	// scroller at once, so the scroller is exposed rather than lifted: where a
	// row sits is the virtualiser's to say, and it exists nowhere else. Which
	// row to go to is the model's; this only says where the reader is and goes
	// where it is told.
	useImperativeHandle(
		file.viewport,
		() => ({
			topRow() {
				const top = scroller.current?.scrollTop ?? 0;
				return virtualizer.getVirtualItemForOffset(top)?.index ?? 0;
			},
			scrollToRow(index) {
				virtualizer.scrollToIndex(index, { align: "start" });
			},
		}),
		[virtualizer],
	);

	// The scroll position is the file's, not the viewer's: the virtualiser
	// starts at it above, and it is handed back on the way out.
	const at = useScrollMemory(file.scrollTop, file.rememberScroll);
	useCloseOnEscape(onClose);

	return (
		<div
			className={styles.viewer}
			data-testid="diff-view"
			data-path={path}
			// Set rather than styled inline: what it looks like to be waiting is
			// the stylesheet's business, and the state is readable from the DOM.
			data-pending={pending ? "" : undefined}
			// How much of the file is showing: rows, folds included.
			data-rows={rows.length}
			// What the file was taken to be written in — the one decision the
			// colouring of every row follows from.
			data-language={language ?? ""}
			// Whether the syntax theme paints on a light ground or a dark one.
			// The added and removed washes, the gutters and the frame are keyed
			// off this rather than off the page theme: a light theme colours its
			// tokens for a white page, and reading them over the page's dark
			// surfaces gave a file of alternately light and dark lines (#139).
			// Absent until the stored choice has been read, which leaves the
			// page theme's own surfaces standing — what they were before.
			data-syntax={syntax ?? undefined}
			style={
				{
					"--gutter-width": `calc(${gutterChars(lines)}ch + var(--space-4))`,
				} as CSSProperties
			}
		>
			{/* `hljs` is what the theme's stylesheet colours: it carries the
			    theme's background and base text colour, and the added and removed
			    surfaces paint over it. */}
			<div
				className={`${styles.scroller} hljs`}
				ref={scroller}
				data-testid="diff-scroller"
				onScroll={(event) => {
					at.current = event.currentTarget.scrollTop;
				}}
			>
				<table className={styles.sizer} aria-label={path} style={{ height }}>
					<tbody>
						{virtualizer.getVirtualItems().map((item) => {
							const row = rows[item.index];
							if (!row) return null;
							const placement = {
								index: item.index,
								ref: virtualizer.measureElement,
								style: { transform: `translateY(${item.start}px)` },
							};

							if (row.kind === "pair") {
								return (
									<SplitDiffRow
										key={item.key}
										language={language}
										left={row.left}
										right={row.right}
										{...placement}
									/>
								);
							}

							return row.kind === "line" ? (
								<DiffRow
									key={item.key}
									language={language}
									line={row.line}
									{...placement}
								/>
							) : (
								<CollapsedRow
									fold={row}
									key={item.key}
									onReveal={file.reveal}
									{...placement}
								/>
							);
						})}
					</tbody>
				</table>
			</div>
			<DiffScrollbar
				file={file}
				scroller={scroller}
				spans={virtualizer.measurementsCache}
			/>
		</div>
	);
}
