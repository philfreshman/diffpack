import { type CSSProperties, useRef } from "react";
import { useStateResetOn } from "#/components/lifecycle/useStateResetOn.ts";
import { FileHeader } from "#/components/review/FileHeader/FileHeader.tsx";
import {
	type RowDisplay,
	StreamRows,
} from "#/components/review/StreamRows/StreamRows.tsx";
import type { StreamLayoutRefs } from "#/components/review/StreamRows/useStreamVirtualizer.ts";
import { Button } from "#/components/ui/Button/Button.tsx";
import { Spinner } from "#/components/ui/Spinner/Spinner.tsx";
import type { LineAnchor } from "#/lib/diff/lineAnchor.ts";
import { estimatedRows } from "#/lib/review/fileStream.ts";
import type { DiffFileEntry, FileDiff } from "#/lib/worker/protocol.ts";
import styles from "./FileCard.module.css";
import { type CardModel, useCardModel } from "./useCardModel.ts";
import { type FileLoad, useFileLoad } from "./useFileLoad.ts";
import { useNearViewport } from "./useNearViewport.ts";

const LINE_COUNT = new Intl.NumberFormat("en-US");

export interface FileCardProps {
	entry: DiffFileEntry;
	layout: StreamLayoutRefs;
	display: RowDisplay & { split: boolean };
	readFile(entry: DiffFileEntry): Promise<FileDiff>;
	viewed: boolean;
	onViewedChange(viewed: boolean): void;
	onCollapse(): void;
	onOpenFile(): void;
	onSelectLine(anchor: LineAnchor): void;
}

export function FileCard({
	entry,
	layout,
	display,
	readFile,
	viewed,
	onViewedChange,
	onCollapse,
	onOpenFile,
	onSelectLine,
}: FileCardProps) {
	const articleRef = useRef<HTMLElement>(null);
	const [open, setOpen] = useStateResetOn(() => !viewed, [viewed]);
	const near = useNearViewport(articleRef, layout.scrollerRef);
	const { load, retry } = useFileLoad(entry, readFile, near && open);
	const card = useCardModel(entry.path, load, display.split);

	function changeOpen(next: boolean) {
		if (!next) onCollapse();
		setOpen(next);
	}

	return (
		<article
			className={styles.card}
			data-collapsed={presentWhen(!open)}
			data-path={entry.path}
			data-state={load.state}
			data-testid="stream-file"
			data-viewed={presentWhen(viewed)}
			ref={articleRef}
		>
			<FileHeader
				entry={entry}
				expandAll={card.expandAll}
				onExpandAllChange={card.setExpandAll}
				onOpenChange={changeOpen}
				onOpenFile={onOpenFile}
				onViewedChange={onViewedChange}
				open={open}
				viewed={viewed}
			/>
			{open && (
				<CardBody
					card={card}
					display={display}
					entry={entry}
					layout={layout}
					load={load}
					near={near}
					onRetry={retry}
					onSelectLine={onSelectLine}
				/>
			)}
		</article>
	);
}

interface CardBodyProps {
	entry: DiffFileEntry;
	load: FileLoad;
	card: CardModel;
	near: boolean;
	layout: StreamLayoutRefs;
	display: RowDisplay;
	onRetry(): void;
	onSelectLine(anchor: LineAnchor): void;
}

function CardBody({
	entry,
	load,
	card,
	near,
	layout,
	display,
	onRetry,
	onSelectLine,
}: CardBodyProps) {
	const { model } = card;

	if (load.state === "error") {
		return <LoadFailure message={load.message} onRetry={onRetry} />;
	}

	if (!model) {
		return <Placeholder entry={entry} loading={load.state === "loading"} />;
	}

	if (model.rows.length === 0) {
		return <p className={styles.quiet}>This file is empty.</p>;
	}

	if (card.gated) {
		return (
			<div className={styles.notice}>
				<p className={styles.message}>
					Large diffs are not rendered by default.
				</p>
				<Button onClick={card.acceptLarge}>
					Load diff ({LINE_COUNT.format(model.lines.length)} lines)
				</Button>
			</div>
		);
	}

	return (
		<StreamRows
			display={display}
			layout={layout}
			model={model}
			near={near}
			onReveal={card.reveal}
			onSelectLine={onSelectLine}
		/>
	);
}

function LoadFailure({
	message,
	onRetry,
}: {
	message: string;
	onRetry(): void;
}) {
	return (
		<div className={styles.notice} role="alert">
			<p className={styles.message}>
				<span className={styles.failed}>Couldn't load this file.</span>{" "}
				{message}
			</p>
			<Button onClick={onRetry}>Retry</Button>
		</div>
	);
}

function Placeholder({
	entry,
	loading,
}: {
	entry: DiffFileEntry;
	loading: boolean;
}) {
	return (
		<div
			aria-busy={loading}
			className={styles.placeholder}
			style={{ "--rows": estimatedRows(entry) } as CSSProperties}
		>
			{loading && (
				<span className={styles.loading}>
					<Spinner label="Loading diff" />
					Loading diff…
				</span>
			)}
		</div>
	);
}

function presentWhen(flag: boolean): "" | undefined {
	return flag ? "" : undefined;
}
