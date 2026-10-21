import type { MouseEvent } from "react";
import { formatLineAnchor, type LineAnchor } from "#/lib/diff/lineAnchor.ts";
import styles from "./LineNumber.module.css";

const PRIMARY_BUTTON = 0;

export function LineNumber({
	number,
	anchor,
	onSelect,
}: {
	number: number | null;
	anchor: LineAnchor | null;
	onSelect(anchor: LineAnchor): void;
}) {
	if (number === null || !anchor) return null;

	return (
		<a
			className={styles.link}
			href={`#${formatLineAnchor(anchor)}`}
			onClick={(event) => {
				if (opensElsewhere(event)) return;
				event.preventDefault();
				onSelect(anchor);
			}}
		>
			{number}
		</a>
	);
}

function opensElsewhere(event: MouseEvent): boolean {
	return (
		event.button !== PRIMARY_BUTTON ||
		event.metaKey ||
		event.ctrlKey ||
		event.shiftKey ||
		event.altKey
	);
}
