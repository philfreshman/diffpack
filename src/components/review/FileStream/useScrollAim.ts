import { type RefObject, useEffect, useEffectEvent, useRef } from "react";
import {
	isOffTarget,
	offsetWithin,
} from "#/components/review/streamGeometry.ts";
import type { StreamRefs } from "./streamRefs.ts";

const USER_SCROLL_EVENTS = ["wheel", "touchstart", "pointerdown"] as const;
const PIN_RELEASE_DELAY_MS = 1500;
const SMOOTH_REACH_IN_VIEWPORTS = 2;

export interface ScrollAim {
	aimedIndexRef: RefObject<number | null>;
	scrollToIndex(index: number, behavior: ScrollBehavior): void;
	scrollToTop(behavior: ScrollBehavior): void;
}

export function useScrollAim({
	scrollerRef,
	contentRef,
	cardsRef,
}: StreamRefs): ScrollAim {
	const aimedIndexRef = useRef<number | null>(null);
	const pinnedIndexRef = useRef<number | null>(null);
	const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	function cardAt(index: number): Element | null {
		return cardsRef.current?.children.item(index) ?? null;
	}

	function releasePinLater() {
		if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
		releaseTimerRef.current = setTimeout(() => {
			pinnedIndexRef.current = null;
		}, PIN_RELEASE_DELAY_MS);
	}

	function realign(behavior: ScrollBehavior) {
		const scroller = scrollerRef.current;
		const pinned = pinnedIndexRef.current;
		const card = pinned === null ? null : cardAt(pinned);
		if (!scroller || !card) return;

		const target = offsetWithin(scroller, card);
		if (isOffTarget(scroller, target))
			scroller.scrollTo({ top: target, behavior });
	}

	const settle = useEffectEvent(() => {
		aimedIndexRef.current = null;
		realign("instant");
		releasePinLater();
	});

	const followResize = useEffectEvent(() => {
		const moving = aimedIndexRef.current !== null;
		realign(moving ? "smooth" : "instant");
		if (!moving && pinnedIndexRef.current !== null) releasePinLater();
	});

	useEffect(() => {
		const scroller = scrollerRef.current;
		const content = contentRef.current;
		if (!scroller || !content) return;

		const release = () => {
			aimedIndexRef.current = null;
			pinnedIndexRef.current = null;
		};
		scroller.addEventListener("scrollend", settle);
		for (const type of USER_SCROLL_EVENTS) {
			scroller.addEventListener(type, release, { passive: true });
		}
		const resizes = new ResizeObserver(followResize);
		resizes.observe(content);

		return () => {
			scroller.removeEventListener("scrollend", settle);
			for (const type of USER_SCROLL_EVENTS) {
				scroller.removeEventListener(type, release);
			}
			resizes.disconnect();
		};
	}, [scrollerRef, contentRef]);

	useEffect(
		() => () => {
			if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
		},
		[],
	);

	function scrollToIndex(index: number, behavior: ScrollBehavior) {
		const scroller = scrollerRef.current;
		const card = cardAt(index);
		if (!scroller || !card) return;

		const top = offsetWithin(scroller, card);
		aimedIndexRef.current = index;
		pinnedIndexRef.current = index;
		scroller.scrollTo({ top, behavior: withinReach(scroller, top, behavior) });
	}

	function scrollToTop(behavior: ScrollBehavior) {
		aimedIndexRef.current = null;
		pinnedIndexRef.current = null;
		scrollerRef.current?.scrollTo({ top: 0, behavior });
	}

	return { aimedIndexRef, scrollToIndex, scrollToTop };
}

function withinReach(
	scroller: HTMLElement,
	top: number,
	behavior: ScrollBehavior,
): ScrollBehavior {
	const reach = scroller.clientHeight * SMOOTH_REACH_IN_VIEWPORTS;

	return Math.abs(top - scroller.scrollTop) > reach ? "instant" : behavior;
}
