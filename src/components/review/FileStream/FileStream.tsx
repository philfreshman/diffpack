import {
	type ReactNode,
	type RefObject,
	useImperativeHandle,
	useRef,
} from "react";
import { DiffScrollbar } from "#/components/diff/DiffScrollbar/DiffScrollbar.tsx";
import { FileCard } from "#/components/review/FileCard/FileCard.tsx";
import { ReviewBar } from "#/components/review/ReviewBar/ReviewBar.tsx";
import type { LineAnchor } from "#/lib/diff/lineAnchor.ts";
import type { DiffFileEntry, FileDiff } from "#/lib/worker/protocol.ts";
import styles from "./FileStream.module.css";
import { useStreamNavigation } from "./useStreamNavigation.ts";

export interface FileStreamHandle {
	scrollToFile(path: string): void;
	stepFile(direction: 1 | -1): void;
}

export interface FileStreamProps {
	streamRef: RefObject<FileStreamHandle | null>;
	files: readonly DiffFileEntry[];
	header: ReactNode;
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
	header,
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
	const scrollerRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const cardsRef = useRef<HTMLDivElement>(null);
	const barRef = useRef<HTMLDivElement>(null);
	const navigation = useStreamNavigation(
		files,
		{ scrollerRef, contentRef, cardsRef, barRef },
		onCurrentFileChange,
	);
	const layout = { scrollerRef, contentRef };
	const display = { split, showSigns, highlightTheme };

	function changeViewed(path: string, isViewed: boolean) {
		if (isViewed) navigation.keepPlace(path, "next");
		onViewedChange(path, isViewed);
	}

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
					<div className={styles.header}>{header}</div>
					<ReviewBar
						barRef={barRef}
						currentIndex={navigation.currentIndex}
						files={files}
						onJump={navigation.scrollToFile}
						onStepFile={navigation.stepFile}
						onViewedChange={changeViewed}
						viewed={viewed}
					/>
					<div className={styles.cards} ref={cardsRef}>
						{files.map((entry) => (
							<FileCard
								display={display}
								entry={entry}
								key={entry.path}
								layout={layout}
								onCollapse={() => navigation.keepPlace(entry.path, "self")}
								onOpenFile={() => onOpenFile(entry.path)}
								onSelectLine={(anchor) => onSelectLine(entry.path, anchor)}
								onViewedChange={(isViewed) =>
									changeViewed(entry.path, isViewed)
								}
								readFile={readFile}
								viewed={viewed.has(entry.path)}
							/>
						))}
					</div>
					<StreamEnd fileCount={files.length} />
				</div>
			</div>
			<div className={styles.rail}>
				<DiffScrollbar autohide={autohideScrollbar} scrollerRef={scrollerRef} />
			</div>
		</div>
	);
}

function StreamEnd({ fileCount }: { fileCount: number }) {
	return (
		<p className={styles.end}>
			End of the changes · {fileCount} {fileCount === 1 ? "file" : "files"}
		</p>
	);
}
