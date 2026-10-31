import type { RefObject } from "react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
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

type HoldReason = "hovering" | "dragging";

/** Drives `scrollTop` only; the thumb is always drawn from the scroll position. */
export function useDiffScrollbar(
	scrollerRef: RefObject<HTMLElement | null>,
	autohide: boolean,
): DiffScrollbar {
	const visibility = useAutohide();
	const thumb = useThumb(scrollerRef, visibility.flash);
	const trackRef = useRef<HTMLDivElement>(null);

	function onThumbMouseDown(event: React.MouseEvent) {
		const element = scrollerRef.current;
		if (!element) return;
		// Otherwise the drag selects the file's text.
		event.preventDefault();
		event.stopPropagation();

		visibility.hold("dragging");
		dragScroller(element, event.clientY, () => visibility.release("dragging"));
	}

	function onTrackMouseDown(event: React.MouseEvent) {
		const element = scrollerRef.current;
		const rect = trackRef.current?.getBoundingClientRect();
		if (!element || !rect) return;

		element.scrollTop = scrollForTrackClick(element, event.clientY - rect.top);
	}

	function onTrackMouseEnter() {
		visibility.hold("hovering");
		visibility.keepShown();
	}

	return {
		thumb,
		shown: visibility.shown || !autohide,
		trackRef,
		onTrackMouseDown,
		onThumbMouseDown,
		onTrackMouseEnter,
		onTrackMouseLeave: () => visibility.release("hovering"),
	};
}

function useAutohide() {
	const [shown, setShown] = useState(false);
	const heldRef = useRef<Record<HoldReason, boolean>>({
		hovering: false,
		dragging: false,
	});
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	function cancelHide() {
		if (timerRef.current) clearTimeout(timerRef.current);
	}

	function hideLater() {
		cancelHide();
		timerRef.current = setTimeout(() => {
			if (heldRef.current.hovering || heldRef.current.dragging) return;
			setShown(false);
		}, HIDE_DELAY);
	}

	useEffect(
		() => () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		},
		[],
	);

	return {
		shown,
		flash() {
			setShown(true);
			hideLater();
		},
		keepShown() {
			setShown(true);
			cancelHide();
		},
		hold(reason: HoldReason) {
			heldRef.current[reason] = true;
		},
		release(reason: HoldReason) {
			heldRef.current[reason] = false;
			hideLater();
		},
	};
}

function useThumb(
	scrollerRef: RefObject<HTMLElement | null>,
	onScrolled: () => void,
): Thumb | null {
	const [thumb, setThumb] = useState<Thumb | null>(null);
	const scrolled = useEffectEvent(onScrolled);

	useEffect(() => {
		const element = scrollerRef.current;
		if (!element) return;

		const measure = () => setThumb(thumbMetrics(element));
		const onScroll = () => {
			measure();
			scrolled();
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

	return thumb;
}

function dragScroller(
	element: HTMLElement,
	startY: number,
	onRelease: () => void,
): void {
	const startScrollTop = element.scrollTop;

	const onMove = (move: MouseEvent) => {
		element.scrollTop = scrollForDrag(
			element,
			startScrollTop,
			move.clientY - startY,
		);
	};

	const onUp = () => {
		document.removeEventListener("mousemove", onMove);
		document.removeEventListener("mouseup", onUp);
		onRelease();
	};

	document.addEventListener("mousemove", onMove);
	document.addEventListener("mouseup", onUp);
}
