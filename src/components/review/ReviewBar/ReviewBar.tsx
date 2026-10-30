import { type CSSProperties, type RefObject, useState } from "react";
import { Button } from "#/components/ui/Button/Button.tsx";
import { CheckIcon } from "#/components/ui/icons.tsx";
import { Kbd } from "#/components/ui/Kbd/Kbd.tsx";
import { useKeyShortcut } from "#/components/ui/useKeyShortcut.ts";
import {
	nextUnviewed,
	type ReviewProgress,
	reviewProgress,
} from "#/lib/review/fileStream.ts";
import type { DiffFileEntry } from "#/lib/worker/protocol.ts";
import styles from "./ReviewBar.module.css";

const SEGMENT_LIMIT = 60;

const SPARK_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

export interface ReviewBarProps {
	barRef: RefObject<HTMLDivElement | null>;
	files: readonly DiffFileEntry[];
	viewed: ReadonlySet<string>;
	currentIndex: number;
	onJump(path: string): void;
	onStepFile(direction: 1 | -1): void;
	onViewedChange(path: string, viewed: boolean): void;
}

export function ReviewBar({
	barRef,
	files,
	viewed,
	currentIndex,
	onJump,
	onStepFile,
	onViewedChange,
}: ReviewBarProps) {
	const progress = reviewProgress(files, viewed);
	const upNext = nextUnviewed(files, viewed, currentIndex);
	const current = files[currentIndex];
	const celebration = useCelebration(progress.done);

	function jumpToNextUnviewed() {
		if (upNext) onJump(upNext.path);
	}

	useKeyShortcut("j", () => onStepFile(1));
	useKeyShortcut("k", () => onStepFile(-1));
	useKeyShortcut("n", jumpToNextUnviewed);
	useKeyShortcut("v", () => {
		if (current) onViewedChange(current.path, !viewed.has(current.path));
	});

	return (
		<div
			className={styles.bar}
			data-done={progress.done ? "" : undefined}
			data-testid="review-progress"
			data-total={progress.total}
			data-viewed={progress.viewed}
			ref={barRef}
		>
			<div className={styles.panel}>
				<ProgressCount celebration={celebration} progress={progress} />
				<ProgressMeter
					celebration={celebration}
					currentIndex={currentIndex}
					files={files}
					onJump={onJump}
					progress={progress}
					viewed={viewed}
				/>
				<span className={styles.hints}>
					<span className={styles.hint}>
						<Kbd keys="j" />
						<Kbd keys="k" />
						files
					</span>
					<span className={styles.hint}>
						<Kbd keys="v" />
						viewed
					</span>
				</span>
				<Button
					className={styles.next}
					data-testid="next-unviewed"
					disabled={!upNext}
					onClick={jumpToNextUnviewed}
					title="Jump to the next file you have not viewed"
				>
					<span className={styles.nextLabel}>
						Next unviewed
						<Kbd keys="n" />
					</span>
				</Button>
			</div>
		</div>
	);
}

function ProgressCount({
	progress,
	celebration,
}: {
	progress: ReviewProgress;
	celebration: number;
}) {
	if (!progress.done) {
		return (
			<p className={styles.count}>
				<strong className={styles.number}>{progress.viewed}</strong> of{" "}
				{progress.total} files viewed
			</p>
		);
	}

	return (
		<p className={styles.count} data-done="">
			<span className={styles.badge} key={celebration}>
				<CheckIcon height="14" strokeWidth="3" width="14" />
				{celebration > 0 && <Sparks />}
			</span>
			All {progress.total} files viewed
		</p>
	);
}

function Sparks() {
	return (
		<span aria-hidden="true" className={styles.sparks}>
			{SPARK_ANGLES.map((angle) => (
				<span
					className={styles.spark}
					key={angle}
					style={{ "--angle": `${angle}deg` } as CSSProperties}
				/>
			))}
		</span>
	);
}

interface ProgressMeterProps {
	files: readonly DiffFileEntry[];
	viewed: ReadonlySet<string>;
	progress: ReviewProgress;
	currentIndex: number;
	celebration: number;
	onJump(path: string): void;
}

function ProgressMeter({
	files,
	viewed,
	progress,
	currentIndex,
	celebration,
	onJump,
}: ProgressMeterProps) {
	const sheen = celebration > 0 && progress.done && (
		<span aria-hidden="true" className={styles.sheen} key={celebration} />
	);

	if (files.length > SEGMENT_LIMIT) {
		return (
			<div
				aria-label="Files viewed"
				aria-valuemax={progress.total}
				aria-valuemin={0}
				aria-valuenow={progress.viewed}
				className={styles.meter}
				role="progressbar"
			>
				<span
					className={styles.fill}
					style={
						{
							"--progress": progress.viewed / progress.total,
						} as CSSProperties
					}
				/>
				{sheen}
			</div>
		);
	}

	return (
		<div aria-label="Jump to a file" className={styles.meter} role="group">
			{files.map((entry, index) => (
				<button
					aria-label={`Jump to ${entry.path}`}
					className={styles.segment}
					data-current={index === currentIndex ? "" : undefined}
					data-viewed={viewed.has(entry.path) ? "" : undefined}
					key={entry.path}
					onClick={() => onJump(entry.path)}
					tabIndex={-1}
					title={entry.path}
					type="button"
				/>
			))}
			{sheen}
		</div>
	);
}

function useCelebration(done: boolean): number {
	const [seen, setSeen] = useState({ done, count: 0 });
	if (seen.done !== done) {
		setSeen({ done, count: done ? seen.count + 1 : seen.count });
	}

	return seen.count;
}
