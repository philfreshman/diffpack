import type { VirtualRowProps } from "#/components/diff/virtualRow.ts";
import { highlightLine } from "#/lib/diff/highlight.ts";
import type { DiffLine } from "#/lib/diff/parseUnifiedDiff.ts";
import styles from "./DiffRow.module.css";

export function DiffRow({
	line,
	language,
	index,
	style,
	ref,
}: VirtualRowProps & { line: DiffLine; language: string | null }) {
	return (
		<tr
			className={styles.row}
			data-index={index}
			data-type={line.type}
			ref={ref}
			style={style}
		>
			<td
				className={styles.gutter}
				data-testid="old-number"
				data-filled={line.oldNumber === null ? undefined : true}
			>
				{line.oldNumber}
			</td>
			<td
				className={styles.gutter}
				data-testid="new-number"
				data-filled={line.newNumber === null ? undefined : true}
			>
				{line.newNumber}
			</td>
			<td
				className={styles.content}
				// highlightLine escapes everything it does not highlight.
				// biome-ignore lint/security/noDangerouslySetInnerHtml: the highlighter's output is markup by definition
				dangerouslySetInnerHTML={{
					__html: highlightLine(line.content, language) || " ",
				}}
			/>
		</tr>
	);
}
