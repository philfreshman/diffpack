import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import {
	scrollForDrag,
	scrollForTrackClick,
	type Thumb,
	thumbMetrics,
} from "#/lib/diff/scrollbar.ts";

const HIDE_DELAY = 600;

export interface DiffScrollbar {
	/** `null` while the file fits on screen. */
	thumb: Thumb | null;
	shown: boolean;
	trackRef: RefObject<HTMLDivElement | null>;
	onTrackMouseDown(event: React.MouseEvent): void;
	onThumbMouseDown(event: React.MouseEvent): void;
	onTrackMouseEnter(): void;
	onTrackMouseLeave(): void;
}

/** Drives `scrollTop` only; the thumb is always drawn from the scroll position. */
export function useDiffScrollbar(
	scrollerRef: RefObject<HTMLElement | null>,
): DiffScrollbar {
	const [thumb, setThumb] = useState<Thumb | null>(null);
	const [shown, setShown] = useState(false);
	const trackRef = useRef<HTMLDivElement>(null);

	const heldRef = useRef({ hovering: false, dragging: false });
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	function hideLater() {
		if (timerRef.current) clearTimeout(timerRef.current);
		timerRef.current = setTimeout(() => {
			if (heldRef.current.hovering || heldRef.current.dragging) return;
			setShown(false);
		}, HIDE_DELAY);
	}

	useEffect(() => {
		const element = scrollerRef.current;
		if (!element) return;

		const measure = () => setThumb(thumbMetrics(element));
		const onScroll = () => {
			measure();
			setShown(true);
			hideLater();
		};

		element.addEventListener("scroll", onScroll, { passive: true });

		// Folds, resizes and remeasured rows change the height without a scroll.
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		const content = element.firstElementChild;
		if (content) observer.observe(content);

		return () => {
			element.removeEventListener("scroll", onScroll);
			observer.disconnect();
		};
	}, [scrollerRef]);

	useEffect(
		() => () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		},
		[],
	);

	function onThumbMouseDown(event: React.MouseEvent) {
		const element = scrollerRef.current;
		if (!element) return;
		// Otherwise the drag selects the file's text.
		event.preventDefault();
		event.stopPropagation();

		const startY = event.clientY;
		const startScrollTop = element.scrollTop;
		heldRef.current.dragging = true;

		const onMove = (move: MouseEvent) => {
			element.scrollTop = scrollForDrag(
				element,
				startScrollTop,
				move.clientY - startY,
			);
		};

		const onUp = () => {
			heldRef.current.dragging = false;
			document.removeEventListener("mousemove", onMove);
			document.removeEventListener("mouseup", onUp);
			hideLater();
		};

		document.addEventListener("mousemove", onMove);
		document.addEventListener("mouseup", onUp);
	}

	function onTrackMouseDown(event: React.MouseEvent) {
		const element = scrollerRef.current;
		const rect = trackRef.current?.getBoundingClientRect();
		if (!element || !rect) return;

		element.scrollTop = scrollForTrackClick(element, event.clientY - rect.top);
	}

	function onTrackMouseEnter() {
		heldRef.current.hovering = true;
		setShown(true);
		if (timerRef.current) clearTimeout(timerRef.current);
	}

	function onTrackMouseLeave() {
		heldRef.current.hovering = false;
		hideLater();
	}

	return {
		thumb,
		shown,
		trackRef,
		onTrackMouseDown,
		onThumbMouseDown,
		onTrackMouseEnter,
		onTrackMouseLeave,
	};
}
