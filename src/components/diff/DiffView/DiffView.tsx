import type { CSSProperties, ReactNode, RefObject } from "react";
import { useRef } from "react";
import { CollapsedRow } from "#/components/diff/CollapsedRow/CollapsedRow.tsx";
import { DiffRow } from "#/components/diff/DiffRow/DiffRow.tsx";
import { FileScrollbar } from "#/components/diff/DiffScrollbar/DiffScrollbar.tsx";
import { SplitDiffRow } from "#/components/diff/SplitDiffRow/SplitDiffRow.tsx";
import type { FileModelControls } from "#/components/diff/useFileModel.ts";
import type {
	SelectableRowProps,
	VirtualRowProps,
} from "#/components/diff/virtualRow.ts";
import { gutterChars } from "#/lib/diff/gutter.ts";
import { highlightAppearance } from "#/lib/diff/highlightThemes.ts";
import { isAnchoredRow, type LineAnchor } from "#/lib/diff/lineAnchor.ts";
import type { TextRange } from "#/lib/diff/inlineChange.ts";
import type { SplitSide } from "#/lib/diff/pairSplitRows.ts";
import { emphasisStyle } from "#/lib/diff/themeEmphasis.ts";
import styles from "./DiffView.module.css";
import { useAnchorSeek } from "./useAnchorSeek.ts";
import { useCloseOnEscape } from "./useCloseOnEscape.ts";
import { useOneSidedSelection } from "./useOneSidedSelection.ts";
import {
	offsetInEstimatedRows,
	useRowVirtualizer,
} from "./useRowVirtualizer.ts";
import { useScrollMemory } from "./useScrollMemory.ts";

export interface DiffViewProps {
	file: FileModelControls;
	header: ReactNode;
	folded: boolean;
	onClose(): void;
	pending?: boolean;
	showSigns: boolean;
	autohideScrollbar: boolean;
	anchor: LineAnchor | null;
	onSelectLine(anchor: LineAnchor): void;
	/** `null` until the stored theme has been read. */
	highlightTheme: string | null;
}

export function DiffView({
	file,
	header,
	folded,
	onClose,
	pending,
	showSigns,
	autohideScrollbar,
	anchor,
	onSelectLine,
	highlightTheme,
}: DiffViewProps) {
	"use no memo";

	const scroller = useRef<HTMLDivElement>(null);
	const virtualizer = useRowVirtualizer(file, scroller);

	// Also refreshes measurementsCache, which the scrollbar reads below.
	const height = virtualizer.getTotalSize();

	useAnchorSeek(file, anchor, virtualizer);
	const scrollTopRef = useScrollMemory(file.scrollTop, file.rememberScroll);
	useCloseOnEscape(onClose);
	useOneSidedSelection(scroller);

	return (
		<div
			className={styles.viewer}
			data-testid="diff-view"
			{...viewerData(file, { pending, showSigns, highlightTheme })}
			style={viewerStyle(file.lines, highlightTheme)}
		>
			{header}
			<div className={styles.body} hidden={folded}>
				<DiffScroller
					anchor={anchor}
					file={file}
					height={height}
					onSelectLine={onSelectLine}
					scrollerRef={scroller}
					scrollTopRef={scrollTopRef}
					virtualizer={virtualizer}
				/>
				<FileScrollbar
					autohide={autohideScrollbar}
					file={file}
					scrollerRef={scroller}
					spans={virtualizer.measurementsCache}
				/>
			</div>
		</div>
	);
}

function viewerData(
	file: FileModelControls,
	{
		pending,
		showSigns,
		highlightTheme,
	}: Pick<DiffViewProps, "pending" | "showSigns" | "highlightTheme">,
) {
	return {
		"data-path": file.path,
		"data-pending": presentWhen(pending),
		"data-rows": file.rows.length,
		"data-language": file.language ?? "",
		"data-layout": file.split ? "split" : "unified",
		"data-signs": presentWhen(showSigns),
		// Washes and gutters follow the syntax theme's ground, not the page theme (#139).
		"data-syntax": highlightAppearance(highlightTheme) ?? undefined,
	};
}

function viewerStyle(
	lines: FileModelControls["lines"],
	highlightTheme: string | null,
): CSSProperties {
	return {
		"--gutter-width": `max(var(--gutter-min-width), calc(${gutterChars(lines)}ch + var(--space-4)))`,
		...emphasisStyle(highlightTheme),
	} as CSSProperties;
}

type RowVirtualizer = ReturnType<typeof useRowVirtualizer>;

interface VirtualRowsProps {
	file: FileModelControls;
	virtualizer: RowVirtualizer;
	anchor: LineAnchor | null;
	onSelectLine(anchor: LineAnchor): void;
}

interface DiffScrollerProps extends VirtualRowsProps {
	height: number;
	scrollerRef: RefObject<HTMLDivElement | null>;
	scrollTopRef: RefObject<number>;
}

function DiffScroller({
	file,
	virtualizer,
	anchor,
	onSelectLine,
	height,
	scrollerRef,
	scrollTopRef,
}: DiffScrollerProps) {
	"use no memo";

	return (
		/* `hljs` takes the theme stylesheet's background; the change washes paint over it. */
		<div
			className={`${styles.scroller} hljs`}
			ref={scrollerRef}
			data-testid="diff-scroller"
			onScroll={(event) => {
				scrollTopRef.current = offsetInEstimatedRows(
					virtualizer,
					event.currentTarget.scrollTop,
				);
			}}
		>
			<table className={styles.sizer} aria-label={file.path} style={{ height }}>
				<tbody>
					<VirtualRows
						anchor={anchor}
						file={file}
						onSelectLine={onSelectLine}
						virtualizer={virtualizer}
					/>
				</tbody>
			</table>
		</div>
	);
}

function VirtualRows({
	file,
	virtualizer,
	anchor,
	onSelectLine,
}: VirtualRowsProps) {
	"use no memo";

	return virtualizer.getVirtualItems().map((item) => {
		const row = file.rows[item.index];
		if (!row) return null;

		return (
			<ViewRow
				file={file}
				key={item.key}
				placement={{
					index: item.index,
					ref: virtualizer.measureElement,
					style: { transform: `translateY(${item.start}px)` },
				}}
				row={row}
				selection={{
					selected: anchor !== null && isAnchoredRow(row, anchor),
					onSelectLine,
				}}
			/>
		);
	});
}

interface ViewRowProps {
	file: FileModelControls;
	row: FileModelControls["rows"][number];
	placement: VirtualRowProps;
	selection: SelectableRowProps;
}

function ViewRow({ file, row, placement, selection }: ViewRowProps) {
	const { language, changes } = file;

	if (row.kind === "pair") {
		return (
			<SplitDiffRow
				language={language}
				left={row.left}
				leftChange={changeOf(changes, row.left)}
				right={row.right}
				rightChange={changeOf(changes, row.right)}
				{...placement}
				{...selection}
			/>
		);
	}

	return row.kind === "line" ? (
		<DiffRow
			change={changes.get(row.index)}
			language={language}
			line={row.line}
			{...placement}
			{...selection}
		/>
	) : (
		<CollapsedRow fold={row} onReveal={file.reveal} {...placement} />
	);
}

function changeOf(
	changes: ReadonlyMap<number, TextRange>,
	side: SplitSide,
): TextRange | undefined {
	return side ? changes.get(side.index) : undefined;
}

function presentWhen(flag: boolean | undefined): "" | undefined {
	return flag ? "" : undefined;
}
