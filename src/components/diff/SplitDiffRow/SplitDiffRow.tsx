import rowStyles from "#/components/diff/DiffRow/DiffRow.module.css";
import { LineNumber } from "#/components/diff/LineNumber/LineNumber.tsx";
import type {
	SelectableRowProps,
	VirtualRowProps,
} from "#/components/diff/virtualRow.ts";
import { highlightLine } from "#/lib/diff/highlight.ts";
import type { TextRange } from "#/lib/diff/inlineChange.ts";
import { anchorOfLine, type LineAnchor } from "#/lib/diff/lineAnchor.ts";
import type { SplitSide } from "#/lib/diff/pairSplitRows.ts";
import styles from "./SplitDiffRow.module.css";

export function SplitDiffRow({
	left,
	leftChange,
	right,
	rightChange,
	language,
	selected,
	onSelectLine,
	index,
	style,
	ref,
}: VirtualRowProps &
	SelectableRowProps & {
		left: SplitSide;
		leftChange: TextRange | undefined;
		right: SplitSide;
		rightChange: TextRange | undefined;
		language: string | null;
	}) {
	return (
		<tr
			className={rowStyles.row}
			data-index={index}
			data-selected={selected ? "" : undefined}
			data-left-type={left?.line.type ?? "none"}
			data-right-type={right?.line.type ?? "none"}
			ref={ref}
			style={style}
		>
			<Half
				cell={left}
				change={leftChange}
				language={language}
				onSelectLine={onSelectLine}
				side="left"
			/>
			<Half
				cell={right}
				change={rightChange}
				language={language}
				onSelectLine={onSelectLine}
				side="right"
			/>
		</tr>
	);
}

function Half({
	cell,
	change,
	language,
	onSelectLine,
	side,
}: {
	cell: SplitSide;
	change: TextRange | undefined;
	language: string | null;
	onSelectLine(anchor: LineAnchor): void;
	side: "left" | "right";
}) {
	const line = cell?.line;
	const number = side === "left" ? line?.oldNumber : line?.newNumber;
	const anchor = line ? anchorOfLine(line) : null;

	return (
		<td
			className={styles.half}
			data-side={side}
			data-type={line?.type ?? "none"}
		>
			<span className={`${rowStyles.gutter} ${styles.gutter}`}>
				<LineNumber
					anchor={anchor}
					number={number ?? null}
					onSelect={onSelectLine}
				/>
			</span>
			<span
				className={rowStyles.content}
				data-change={line?.type}
				data-testid={`${side}-content`}
				// Escaped by the highlighter either way; see `DiffRow`.
				// oxlint-disable-next-line react/no-danger -- the highlighter's output is markup by definition
				dangerouslySetInnerHTML={{
					__html: line
						? highlightLine(line.content, language, change) || " "
						: "",
				}}
			/>
		</td>
	);
}
