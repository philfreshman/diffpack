import rowStyles from "#/components/diff/DiffRow/DiffRow.module.css";
import type { VirtualRowProps } from "#/components/diff/virtualRow.ts";
import { IconButton } from "#/components/ui/IconButton/IconButton.tsx";
import {
	FoldDownIcon,
	FoldUpIcon,
	UnfoldIcon,
} from "#/components/ui/icons.tsx";
import type { DiffRow, Expander } from "#/lib/diff/computeVisibility.ts";
import styles from "./CollapsedRow.module.css";

type Fold = Extract<DiffRow, { kind: "collapsed" }>;

const STEPPED_ORDER = ["up", "down"] as const;

export function CollapsedRow({
	fold,
	onReveal,
	index,
	style,
	ref,
}: VirtualRowProps & { fold: Fold; onReveal(expander: Expander): void }) {
	const stepped = STEPPED_ORDER.flatMap((direction) =>
		fold.expanders.filter((it) => it.direction === direction),
	);
	const whole = fold.expanders.find((it) => it.direction === "all");
	const hasBothWaysExpander = stepped.length > 0 && whole !== undefined;

	return (
		<tr
			className={`${rowStyles.row} ${styles.row}`}
			data-count={fold.count}
			data-end={fold.end}
			data-index={index}
			data-start={fold.start}
			data-testid="fold"
			ref={ref}
			style={style}
		>
			<td className={styles.expanders}>
				{stepped.map((expander) => (
					<ExpandButton
						expander={expander}
						key={expander.direction}
						onReveal={onReveal}
					/>
				))}
				{stepped.length === 0 && whole && (
					<ExpandButton
						expander={whole}
						// The arrow says which way the file continues past the fold.
						icon={fold.start === 0 ? "up" : "down"}
						onReveal={onReveal}
					/>
				)}
			</td>
			<td className={styles.label}>
				{hasBothWaysExpander && (
					<ExpandButton expander={whole} onReveal={onReveal} />
				)}
				<span
					className={hasBothWaysExpander ? undefined : styles.text}
				>{`@@ Collapsed ${fold.count} lines @@`}</span>
			</td>
		</tr>
	);
}

function ExpandButton({
	expander,
	icon = expander.direction,
	onReveal,
}: {
	expander: Expander;
	icon?: Expander["direction"];
	onReveal(expander: Expander): void;
}) {
	const count = expander.end - expander.start + 1;
	const Arrow =
		icon === "up" ? FoldUpIcon : icon === "down" ? FoldDownIcon : UnfoldIcon;

	return (
		<IconButton
			aria-label={
				expander.direction === "all"
					? "Expand all lines"
					: `Expand ${count} ${count === 1 ? "line" : "lines"} ${expander.direction}`
			}
			className={styles.expander}
			onClick={() => onReveal(expander)}
		>
			<Arrow height="14" width="14" />
		</IconButton>
	);
}
