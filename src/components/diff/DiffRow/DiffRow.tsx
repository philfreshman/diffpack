import { LineNumber } from "#/components/diff/LineNumber/LineNumber.tsx";
import type {
	SelectableRowProps,
	VirtualRowProps,
} from "#/components/diff/virtualRow.ts";
import { highlightLine } from "#/lib/diff/highlight.ts";
import type { TextRange } from "#/lib/diff/inlineChange.ts";
import { anchorOfLine } from "#/lib/diff/lineAnchor.ts";
import type { DiffLine } from "#/lib/diff/parseUnifiedDiff.ts";
import styles from "./DiffRow.module.css";

export function DiffRow({
	line,
	language,
	change,
	selected,
	onSelectLine,
	index,
	style,
	ref,
}: VirtualRowProps &
	SelectableRowProps & {
		line: DiffLine;
		language: string | null;
		change: TextRange | undefined;
	}) {
	const anchor = anchorOfLine(line);

	return (
		<tr
			className={styles.row}
			data-index={index}
			data-selected={selected ? "" : undefined}
			data-type={line.type}
			ref={ref}
			style={style}
		>
			<td
				className={styles.gutter}
				data-testid="old-number"
				data-filled={line.oldNumber === null ? undefined : true}
			>
				<LineNumber
					anchor={anchor}
					number={line.oldNumber}
					onSelect={onSelectLine}
				/>
			</td>
			<td
				className={styles.gutter}
				data-testid="new-number"
				data-filled={line.newNumber === null ? undefined : true}
			>
				<LineNumber
					anchor={anchor}
					number={line.newNumber}
					onSelect={onSelectLine}
				/>
			</td>
			<td
				className={styles.content}
				data-change={line.type}
				// highlightLine escapes everything it does not highlight.
				// oxlint-disable-next-line react/no-danger -- the highlighter's output is markup by definition
				dangerouslySetInnerHTML={{
					__html: highlightLine(line.content, language, change) || " ",
				}}
			/>
		</tr>
	);
}
