import type { RefObject } from "react";
import { useMemo } from "react";
import { useDiffScrollbar } from "#/components/diff/useDiffScrollbar.ts";
import type { FileModel } from "#/lib/diff/fileModel.ts";
import type { RowSpan } from "#/lib/diff/scrollbar.ts";
import styles from "./DiffScrollbar.module.css";

export interface DiffScrollbarProps {
	scroller: RefObject<HTMLElement | null>;
	file: Pick<FileModel, "markers">;
	/** Every row's span, estimated until drawn; not just the rendered items. */
	spans: readonly RowSpan[];
}

export function DiffScrollbar({ scroller, file, spans }: DiffScrollbarProps) {
	const bar = useDiffScrollbar(scroller);
	const markers = useMemo(() => file.markers(spans), [file, spans]);

	return (
		<div
			className={styles.track}
			ref={bar.track}
			data-testid="diff-scrollbar"
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
