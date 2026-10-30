import type { VirtualItem } from "@tanstack/react-virtual";
import { type CSSProperties, type Ref, useRef } from "react";
import { CollapsedRow } from "#/components/diff/CollapsedRow/CollapsedRow.tsx";
import { DiffRow } from "#/components/diff/DiffRow/DiffRow.tsx";
import viewStyles from "#/components/diff/DiffView/DiffView.module.css";
import { useOneSidedSelection } from "#/components/diff/DiffView/useOneSidedSelection.ts";
import { SplitDiffRow } from "#/components/diff/SplitDiffRow/SplitDiffRow.tsx";
import type { LineRange } from "#/lib/diff/computeVisibility.ts";
import type { FileModel } from "#/lib/diff/fileModel.ts";
import { gutterChars } from "#/lib/diff/gutter.ts";
import { highlightAppearance } from "#/lib/diff/highlightThemes.ts";
import type { TextRange } from "#/lib/diff/inlineChange.ts";
import type { LineAnchor } from "#/lib/diff/lineAnchor.ts";
import type { SplitSide } from "#/lib/diff/pairSplitRows.ts";
import { emphasisStyle } from "#/lib/diff/themeEmphasis.ts";
import styles from "./StreamRows.module.css";
import {
	type StreamLayoutRefs,
	useStreamVirtualizer,
} from "./useStreamVirtualizer.ts";

export interface RowDisplay {
	showSigns: boolean;
	highlightTheme: string | null;
}

interface StreamRowsProps {
	model: FileModel;
	near: boolean;
	layout: StreamLayoutRefs;
	display: RowDisplay;
	onReveal(range: LineRange): void;
	onSelectLine(anchor: LineAnchor): void;
}

export function StreamRows({
	model,
	near,
	layout,
	display,
	onReveal,
	onSelectLine,
}: StreamRowsProps) {
	"use no memo";

	const bodyRef = useRef<HTMLDivElement>(null);
	const { virtualizer, scrollMargin } = useStreamVirtualizer(
		model.rows.length,
		bodyRef,
		layout,
	);
	const height = virtualizer.getTotalSize();
	const items = near ? virtualizer.getVirtualItems() : [];
	useOneSidedSelection(bodyRef);

	return (
		<div
			className={`${styles.rows} hljs`}
			data-layout={model.split ? "split" : "unified"}
			data-signs={display.showSigns ? "" : undefined}
			data-syntax={highlightAppearance(display.highlightTheme) ?? undefined}
			ref={bodyRef}
			style={
				{
					"--gutter-width": `max(var(--gutter-min-width), calc(${gutterChars(model.lines)}ch + var(--space-4)))`,
					...emphasisStyle(display.highlightTheme),
				} as CSSProperties
			}
		>
			<table
				aria-label={model.path}
				className={viewStyles.sizer}
				data-testid="stream-rows"
				style={{ height }}
			>
				<tbody>
					{items.map((item) => (
						<StreamRow
							item={item}
							key={item.key}
							measureRef={virtualizer.measureElement}
							model={model}
							onReveal={onReveal}
							onSelectLine={onSelectLine}
							top={item.start - scrollMargin}
						/>
					))}
				</tbody>
			</table>
		</div>
	);
}

interface StreamRowProps {
	item: VirtualItem;
	top: number;
	measureRef: Ref<HTMLTableRowElement>;
	model: FileModel;
	onReveal(range: LineRange): void;
	onSelectLine(anchor: LineAnchor): void;
}

function StreamRow({
	item,
	top,
	measureRef,
	model,
	onReveal,
	onSelectLine,
}: StreamRowProps) {
	const row = model.rows[item.index];
	if (!row) return null;

	const { language, changes } = model;
	const placement = {
		index: item.index,
		ref: measureRef,
		style: { transform: `translateY(${top}px)` },
	};
	const selection = { selected: false, onSelectLine };

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

	if (row.kind === "line") {
		return (
			<DiffRow
				change={changes.get(row.index)}
				language={language}
				line={row.line}
				{...placement}
				{...selection}
			/>
		);
	}

	return <CollapsedRow fold={row} onReveal={onReveal} {...placement} />;
}

function changeOf(
	changes: ReadonlyMap<number, TextRange>,
	side: SplitSide,
): TextRange | undefined {
	return side ? changes.get(side.index) : undefined;
}
