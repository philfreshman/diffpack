import {
	elementScroll,
	useVirtualizer,
	type VirtualItem,
	type Virtualizer,
} from "@tanstack/react-virtual";
import { type RefObject, useLayoutEffect, useState } from "react";
import { offsetWithin } from "#/components/review/streamGeometry.ts";

const DIFF_LINE_HEIGHT_PX = 23;

type ScrollRequest = Parameters<typeof elementScroll>[1];

export interface StreamLayoutRefs {
	scrollerRef: RefObject<HTMLDivElement | null>;
	contentRef: RefObject<HTMLDivElement | null>;
}

export function useStreamVirtualizer(
	count: number,
	bodyRef: RefObject<HTMLDivElement | null>,
	{ scrollerRef, contentRef }: StreamLayoutRefs,
) {
	"use no memo";

	const scrollMargin = useScrollMargin(bodyRef, scrollerRef, contentRef);

	// fallow-ignore-next-line added-suppression -- the same React Compiler exception useRowVirtualizer.ts carries for TanStack Virtual
	// oxlint-disable-next-line react/incompatible-library -- skipped by "use no memo": the virtualizer changes without a new identity
	const virtualizer = useVirtualizer({
		count,
		getScrollElement: () => scrollerRef.current,
		estimateSize: () => DIFF_LINE_HEIGHT_PX,
		overscan: 16,
		scrollMargin,
		initialOffset: () => scrollerRef.current?.scrollTop ?? 0,
		scrollToFn: correctOnly,
		useFlushSync: false,
	});
	virtualizer.shouldAdjustScrollPositionOnItemSizeChange = holdsViewportTop;

	return { virtualizer, scrollMargin };
}

function useScrollMargin(
	bodyRef: RefObject<HTMLDivElement | null>,
	scrollerRef: RefObject<HTMLDivElement | null>,
	contentRef: RefObject<HTMLDivElement | null>,
): number {
	const [margin, setMargin] = useState(0);

	useLayoutEffect(() => {
		const body = bodyRef.current;
		const scroller = scrollerRef.current;
		const content = contentRef.current;
		if (!body || !scroller || !content) return;

		const measure = () => setMargin(Math.round(offsetWithin(scroller, body)));
		measure();
		const resizes = new ResizeObserver(measure);
		resizes.observe(content);

		return () => resizes.disconnect();
	}, [bodyRef, scrollerRef, contentRef]);

	return margin;
}

function holdsViewportTop(
	item: VirtualItem,
	_delta: number,
	virtualizer: Virtualizer<HTMLDivElement, Element>,
): boolean {
	const offset = virtualizer.scrollOffset ?? 0;
	const start = virtualizer.options.scrollMargin;
	const end = start + virtualizer.getTotalSize();

	return item.start < offset && start <= offset && offset < end;
}

function correctOnly(
	offset: number,
	request: ScrollRequest,
	virtualizer: Virtualizer<HTMLDivElement, Element>,
): void {
	if (request.adjustments !== undefined) {
		elementScroll(offset, request, virtualizer);
	}
}
