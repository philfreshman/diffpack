import type { RefObject } from "react";
import { useMemo } from "react";
import { useDiffScrollbar } from "#/components/diff/useDiffScrollbar.ts";
import type { FileModel } from "#/lib/diff/fileModel.ts";
import type { RowSpan } from "#/lib/diff/scrollbar.ts";
import styles from "./DiffScrollbar.module.css";

export interface DiffScrollbarProps {
	/** The element the bar scrolls; it is not the bar's to own. */
	scroller: RefObject<HTMLElement | null>;
	/** The file on screen, which says where its changes are. */
	file: Pick<FileModel, "markers">;
	/**
	 * How tall each row measures, as the virtualiser has it: every row has one,
	 * an estimate until the row has been drawn once. Its rendered items would
	 * cover only the rows on screen — the part of the file that needs no
	 * minimap.
	 */
	spans: readonly RowSpan[];
}

/**
 * The diff's own scrollbar, with a minimap of the file's changes down it.
 *
 * The native one cannot carry the markers, and there is nothing to gain from
 * showing both — so the scroller hides its own and this sits over it.
 *
 * Which rows changed is the file's to say; both halves of what the bar draws
 * are placed here, by the same measurements: bands that were placed by some
 * other measure than the thumb's would point at rows the thumb never reaches.
 */
export function DiffScrollbar({ scroller, file, spans }: DiffScrollbarProps) {
	const bar = useDiffScrollbar(scroller);
	const markers = useMemo(() => file.markers(spans), [file, spans]);

	return (
		<div
			className={styles.track}
			ref={bar.track}
			data-testid="diff-scrollbar"
			// The whole bar is a pointer affordance over content that is already
			// reachable by keyboard, so it says what it is doing rather than
			// offering a second way to do it.
			data-shown={bar.thumb ? bar.shown : false}
			aria-hidden="true"
			hidden={!bar.thumb}
			onMouseDown={bar.onTrackMouseDown}
			onMouseEnter={bar.onTrackMouseEnter}
			onMouseLeave={bar.onTrackMouseLeave}
		>
			{markers.map((marker) => (
				<span
					className={styles.marker}
					data-testid="diff-marker"
					data-type={marker.type}
					key={`${marker.type}-${marker.start}`}
					style={{
						top: `${marker.start * 100}%`,
						height: `${(marker.end - marker.start) * 100}%`,
					}}
				/>
			))}
			{bar.thumb ? (
				<div
					// Hidden along with the track it is in: the file it scrolls is
					// reachable without it.
					aria-hidden="true"
					className={styles.thumb}
					data-testid="diff-scrollbar-thumb"
					onMouseDown={bar.onThumbMouseDown}
					style={{ top: bar.thumb.top, height: bar.thumb.height }}
				/>
			) : null}
		</div>
	);
}
