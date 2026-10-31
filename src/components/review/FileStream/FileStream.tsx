import { type RefObject, useImperativeHandle } from "react";
import { DiffScrollbar } from "#/components/diff/DiffScrollbar/DiffScrollbar.tsx";
import {
	FileCard,
	type FileCardProps,
} from "#/components/review/FileCard/FileCard.tsx";
import type { LineAnchor } from "#/lib/diff/lineAnchor.ts";
import type { DiffFileEntry, FileDiff } from "#/lib/worker/protocol.ts";
import styles from "./FileStream.module.css";
import { useFileStream } from "./useFileStream.ts";

export interface FileStreamHandle {
	scrollToFile(path: string): void;
	stepFile(direction: 1 | -1): void;
}

export interface FileStreamProps {
	streamRef: RefObject<FileStreamHandle | null>;
	files: readonly DiffFileEntry[];
	readFile(entry: DiffFileEntry): Promise<FileDiff>;
	viewed: ReadonlySet<string>;
	onViewedChange(path: string, viewed: boolean): void;
	onCurrentFileChange(path: string | null): void;
	onOpenFile(path: string): void;
	onSelectLine(path: string, anchor: LineAnchor): void;
	split: boolean;
	showSigns: boolean;
	autohideScrollbar: boolean;
	highlightTheme: string | null;
}

export function FileStream({
	streamRef,
	files,
	readFile,
	viewed,
	onViewedChange,
	onCurrentFileChange,
	onOpenFile,
	onSelectLine,
	split,
	showSigns,
	autohideScrollbar,
	highlightTheme,
}: FileStreamProps) {
	const { scrollerRef, contentRef, cardsRef, navigation, changeViewed } =
		useFileStream(files, viewed, onViewedChange, onCurrentFileChange);

	useImperativeHandle(streamRef, () => ({
		scrollToFile: navigation.scrollToFile,
		stepFile: navigation.stepFile,
	}));

	return (
		<div className={styles.frame}>
			<div
				className={styles.stream}
				data-current={files[navigation.currentIndex]?.path}
				data-testid="file-stream"
				ref={scrollerRef}
			>
				<div className={styles.content} ref={contentRef}>
					<StreamCards
						cardsRef={cardsRef}
						display={{ split, showSigns, highlightTheme }}
						files={files}
						layout={{ scrollerRef, contentRef }}
						onCollapse={navigation.keepPlace}
						onOpenFile={onOpenFile}
						onSelectLine={onSelectLine}
						onViewedChange={changeViewed}
						readFile={readFile}
						viewed={viewed}
					/>
					<StreamEnd fileCount={files.length} />
				</div>
			</div>
			<div className={styles.rail}>
				<DiffScrollbar autohide={autohideScrollbar} scrollerRef={scrollerRef} />
			</div>
		</div>
	);
}

interface StreamCardsProps extends Pick<
	FileStreamProps,
	| "files"
	| "readFile"
	| "viewed"
	| "onViewedChange"
	| "onOpenFile"
	| "onSelectLine"
> {
	cardsRef: RefObject<HTMLDivElement | null>;
	layout: FileCardProps["layout"];
	display: FileCardProps["display"];
	onCollapse(path: string): void;
}

function StreamCards({
	cardsRef,
	files,
	layout,
	display,
	readFile,
	viewed,
	onViewedChange,
	onCollapse,
	onOpenFile,
	onSelectLine,
}: StreamCardsProps) {
	return (
		<div className={styles.cards} ref={cardsRef}>
			{files.map((entry) => (
				<FileCard
					display={display}
					entry={entry}
					key={entry.path}
					layout={layout}
					onCollapse={() => onCollapse(entry.path)}
					onOpenFile={() => onOpenFile(entry.path)}
					onSelectLine={(anchor) => onSelectLine(entry.path, anchor)}
					onViewedChange={(isViewed) => onViewedChange(entry.path, isViewed)}
					readFile={readFile}
					viewed={viewed.has(entry.path)}
				/>
			))}
		</div>
	);
}

const PUMPKIN = String.raw`
      ___
   ___)__|___
  /  /\   /\  \
 |  /__\ /__\  |
 |     /\      |
 |  \/\/\/\/\  |
  \___________/
`;

function StreamEnd({ fileCount }: { fileCount: number }) {
	return (
		<footer className={styles.end}>
			<p className={styles.endText}>
				End of the changes · {fileCount} {fileCount === 1 ? "file" : "files"}
			</p>
			<pre className={styles.pumpkin} aria-hidden="true">
				{PUMPKIN.slice(1)}
			</pre>
		</footer>
	);
}
