import type { CSSProperties } from "react";
import { useRef } from "react";
import { CollapsedRow } from "#/components/diff/CollapsedRow/CollapsedRow.tsx";
import { DiffRow } from "#/components/diff/DiffRow/DiffRow.tsx";
import { DiffScrollbar } from "#/components/diff/DiffScrollbar/DiffScrollbar.tsx";
import { SplitDiffRow } from "#/components/diff/SplitDiffRow/SplitDiffRow.tsx";
import type { FileModelControls } from "#/components/diff/useFileModel.ts";
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
import { useRowVirtualizer } from "./useRowVirtualizer.ts";
import { useScrollMemory } from "./useScrollMemory.ts";

export interface DiffViewProps {
	file: FileModelControls;
	onClose(): void;
	pending?: boolean;
	showSigns: boolean;
	anchor: LineAnchor | null;
	onSelectLine(anchor: LineAnchor): void;
	/** `null` until the stored theme has been read. */
	highlightTheme: string | null;
}

export function DiffView({
	file,
	onClose,
	pending,
	showSigns,
	anchor,
	onSelectLine,
	highlightTheme,
}: DiffViewProps) {
	"use no memo";

	const { path, lines, language, rows, changes } = file;

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
			data-path={path}
			data-pending={pending ? "" : undefined}
			data-rows={rows.length}
			data-language={language ?? ""}
			data-layout={file.split ? "split" : "unified"}
			data-signs={showSigns ? "" : undefined}
			// Washes and gutters follow the syntax theme's ground, not the page theme (#139).
			data-syntax={highlightAppearance(highlightTheme) ?? undefined}
			style={
				{
					"--gutter-width": `max(var(--gutter-min-width), calc(${gutterChars(lines)}ch + var(--space-4)))`,
					...emphasisStyle(highlightTheme),
				} as CSSProperties
			}
		>
			{/* `hljs` takes the theme stylesheet's background; the change washes paint over it. */}
			<div
				className={`${styles.scroller} hljs`}
				ref={scroller}
				data-testid="diff-scroller"
				onScroll={(event) => {
					scrollTopRef.current = event.currentTarget.scrollTop;
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
							const selection = {
								selected: anchor !== null && isAnchoredRow(row, anchor),
								onSelectLine,
							};

							if (row.kind === "pair") {
								return (
									<SplitDiffRow
										key={item.key}
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
									key={item.key}
									language={language}
									line={row.line}
									{...placement}
									{...selection}
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
				scrollerRef={scroller}
				spans={virtualizer.measurementsCache}
			/>
		</div>
	);
}

function changeOf(
	changes: ReadonlyMap<number, TextRange>,
	side: SplitSide,
): TextRange | undefined {
	return side ? changes.get(side.index) : undefined;
}
