import rowStyles from "#/components/diff/DiffRow/DiffRow.module.css";
import { LineNumber } from "#/components/diff/LineNumber/LineNumber.tsx";
import type {
	SelectableRowProps,
	VirtualRowProps,
} from "#/components/diff/virtualRow.ts";
import { highlightLine } from "#/lib/diff/highlight.ts";
import { anchorOfLine, type LineAnchor } from "#/lib/diff/lineAnchor.ts";
import type { SplitSide } from "#/lib/diff/pairSplitRows.ts";
import styles from "./SplitDiffRow.module.css";

export function SplitDiffRow({
	left,
	right,
	language,
	selected,
	onSelectLine,
	index,
	style,
	ref,
}: VirtualRowProps &
	SelectableRowProps & {
		left: SplitSide;
		right: SplitSide;
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
				language={language}
				onSelectLine={onSelectLine}
				side="left"
			/>
			<Half
				cell={right}
				language={language}
				onSelectLine={onSelectLine}
				side="right"
			/>
		</tr>
	);
}

function Half({
	cell,
	language,
	onSelectLine,
	side,
}: {
	cell: SplitSide;
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
				data-testid={`${side}-content`}
				// Escaped by the highlighter either way; see `DiffRow`.
				// biome-ignore lint/security/noDangerouslySetInnerHtml: the highlighter's output is markup by definition
				dangerouslySetInnerHTML={{
					__html: line ? highlightLine(line.content, language) || " " : "",
				}}
			/>
		</td>
	);
}
