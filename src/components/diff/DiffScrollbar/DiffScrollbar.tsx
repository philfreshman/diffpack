import type { RefObject } from "react";
import { useDiffScrollbar } from "#/components/diff/useDiffScrollbar.ts";
import type { FileModel } from "#/lib/diff/fileModel.ts";
import type { Marker, RowSpan } from "#/lib/diff/scrollbar.ts";
import styles from "./DiffScrollbar.module.css";

const NO_MARKERS: readonly Marker[] = [];

export interface DiffScrollbarProps {
	scrollerRef: RefObject<HTMLElement | null>;
	autohide: boolean;
	markers?: readonly Marker[];
}

export interface FileScrollbarProps extends Omit<
	DiffScrollbarProps,
	"markers"
> {
	file: Pick<FileModel, "markers">;
	/** Every row's span, estimated until drawn; not just the rendered items. */
	spans: readonly RowSpan[];
}

export function FileScrollbar({
	file,
	spans,
	...scrollbar
}: FileScrollbarProps) {
	return <DiffScrollbar {...scrollbar} markers={file.markers(spans)} />;
}

export function DiffScrollbar({
	scrollerRef,
	autohide,
	markers = NO_MARKERS,
}: DiffScrollbarProps) {
	const {
		thumb,
		shown,
		trackRef,
		onTrackMouseDown,
		onThumbMouseDown,
		onTrackMouseEnter,
		onTrackMouseLeave,
	} = useDiffScrollbar(scrollerRef, autohide);

	return (
		<div
			className={styles.track}
			ref={trackRef}
			data-testid="diff-scrollbar"
			data-shown={thumb ? shown : false}
			aria-hidden="true"
			hidden={!thumb}
			onMouseDown={onTrackMouseDown}
			onMouseEnter={onTrackMouseEnter}
			onMouseLeave={onTrackMouseLeave}
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
			{thumb ? (
				<div
					aria-hidden="true"
					className={styles.thumb}
					data-testid="diff-scrollbar-thumb"
					onMouseDown={onThumbMouseDown}
					style={{ top: thumb.top, height: thumb.height }}
				/>
			) : null}
		</div>
	);
}
