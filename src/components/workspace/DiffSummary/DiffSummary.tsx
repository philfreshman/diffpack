import type { ReactNode } from "react";
import { Panel } from "#/components/ui/Panel/Panel.tsx";
import type { TreeSummary } from "#/lib/session/tree.ts";
import { ViewportCenter } from "../ViewportCenter/ViewportCenter.tsx";
import styles from "./DiffSummary.module.css";

const LINE_COUNT = new Intl.NumberFormat("en-US");

interface DiffSummaryProps {
	summary: TreeSummary;
	children: ReactNode;
}

export function DiffSummary({ summary, children }: DiffSummaryProps) {
	const { addedLines, removedLines, changedCount } = summary;

	return (
		<ViewportCenter>
			<Panel className={styles.box} data-testid="diff-summary">
				<div className={styles.overview}>
					<dl className={styles.stats}>
						<LineStat
							label="Lines added"
							value={`+${LINE_COUNT.format(addedLines)}`}
							kind="added"
						/>
						<LineStat
							label="Lines removed"
							value={`-${LINE_COUNT.format(removedLines)}`}
							kind="removed"
						/>
					</dl>
					<ChangeBar added={addedLines} removed={removedLines} />
					<p className={styles.files} data-testid="summary-files">
						{describeFileCount(summary)}
					</p>
					<p className={styles.hint}>
						{changedCount > 0
							? "Pick a file in the tree to see its diff."
							: "Nothing changed between these versions."}
					</p>
				</div>
				{children}
			</Panel>
		</ViewportCenter>
	);
}

interface LineStatProps {
	label: string;
	value: string;
	kind: "added" | "removed";
}

function LineStat({ label, value, kind }: LineStatProps) {
	return (
		<div className={styles.stat}>
			<dt className={styles.label}>{label}</dt>
			<dd
				className={styles.value}
				data-kind={kind}
				data-testid={`summary-${kind}`}
			>
				{value}
			</dd>
		</div>
	);
}

function ChangeBar({ added, removed }: { added: number; removed: number }) {
	if (added + removed === 0) return null;

	return (
		<div className={styles.bar} aria-hidden="true">
			{added > 0 && (
				<span className={styles.added} style={{ flexGrow: added }} />
			)}
			{removed > 0 && (
				<span className={styles.removed} style={{ flexGrow: removed }} />
			)}
		</div>
	);
}

function describeFileCount({ fileCount, changedCount }: TreeSummary): string {
	return `${fileCount} ${fileCount === 1 ? "file" : "files"}, ${changedCount} changed`;
}
