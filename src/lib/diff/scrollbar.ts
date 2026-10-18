import { type Change, type LaidOutRow, rowChange } from "#/lib/diff/changes.ts";

export interface Viewport {
	scrollTop: number;
	scrollHeight: number;
	clientHeight: number;
}

const MIN_THUMB_HEIGHT = 24;

export interface Thumb {
	top: number;
	height: number;
}

export function thumbMetrics(viewport: Viewport): Thumb | null {
	const { scrollTop, scrollHeight, clientHeight } = viewport;
	if (scrollHeight <= clientHeight) return null;

	const height = Math.max(
		MIN_THUMB_HEIGHT,
		(clientHeight / scrollHeight) * clientHeight,
	);
	const progress = scrollTop / (scrollHeight - clientHeight);

	return { top: progress * (clientHeight - height), height };
}

// Centres the thumb on the click rather than paging toward it.
export function scrollForTrackClick(
	viewport: Viewport,
	offset: number,
): number {
	const thumb = thumbMetrics(viewport);
	if (!thumb) return viewport.scrollTop;

	return scrollForThumbTop(viewport, offset - thumb.height / 2, thumb.height);
}

// Measured from the drag's start, not the last frame, so rounding cannot accumulate into drift.
export function scrollForDrag(
	viewport: Viewport,
	startScrollTop: number,
	deltaY: number,
): number {
	// Not spread: an Element's measurements are prototype getters a spread drops.
	const start = thumbMetrics({
		scrollTop: startScrollTop,
		scrollHeight: viewport.scrollHeight,
		clientHeight: viewport.clientHeight,
	});
	if (!start) return startScrollTop;

	return scrollForThumbTop(viewport, start.top + deltaY, start.height);
}

function scrollForThumbTop(
	viewport: Viewport,
	top: number,
	thumbHeight: number,
): number {
	const { scrollHeight, clientHeight } = viewport;
	const maxScrollTop = scrollHeight - clientHeight;
	const progress = top / (clientHeight - thumbHeight);

	return Math.min(Math.max(progress * maxScrollTop, 0), maxScrollTop);
}

/** `start` and `end` are fractions of the file height: `0` is the top, `1` the bottom. */
export interface Marker {
	type: Change;
	start: number;
	end: number;
}

export interface RowSpan {
	start: number;
	end: number;
}

// From the row model, not the DOM (the list is virtualised), and placed by
// measured `spans`, not row counts, because rows wrap.
export function changeMarkers(
	rows: readonly LaidOutRow[],
	spans: readonly RowSpan[],
): Marker[] {
	const height = spans[rows.length - 1]?.end ?? 0;
	if (!height) return [];

	const markers: Marker[] = [];
	let open: Marker | null = null;

	rows.forEach((row, index) => {
		const span = spans[index];
		const type = span && rowChange(row);
		if (!span || !type) {
			open = null;
			return;
		}

		if (open && open.type === type) {
			open.end = span.end / height;
			return;
		}

		open = { type, start: span.start / height, end: span.end / height };
		markers.push(open);
	});

	return markers;
}
