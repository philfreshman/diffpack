import { type RefObject, useEffect, useEffectEvent, useRef } from "react";
import { offsetWithin } from "#/components/review/streamGeometry.ts";
import type { StreamRefs } from "./streamRefs.ts";
import { cardAt, usePinnedCard } from "./usePinnedCard.ts";

const USER_SCROLL_EVENTS = ["wheel", "touchstart", "pointerdown"] as const;
const SMOOTH_REACH_IN_VIEWPORTS = 2;

export interface ScrollAim {
	aimedIndexRef: RefObject<number | null>;
	scrollToIndex(index: number, behavior: ScrollBehavior): void;
	scrollToTop(behavior: ScrollBehavior): void;
}

interface ScrollerReactions {
	onScrollEnd(): void;
	onUserScroll(): void;
	onContentResize(): void;
}

export function useScrollAim(refs: StreamRefs): ScrollAim {
	const { scrollerRef, contentRef, cardsRef } = refs;
	const aimedIndexRef = useRef<number | null>(null);
	const pinned = usePinnedCard(refs);

	function forgetAim() {
		aimedIndexRef.current = null;
		pinned.unpin();
	}

	const settle = useEffectEvent(() => {
		aimedIndexRef.current = null;
		pinned.realign("instant");
		pinned.releaseLater();
	});

	const followResize = useEffectEvent(() => {
		const moving = aimedIndexRef.current !== null;
		pinned.realign(moving ? "smooth" : "instant");
		if (!moving && pinned.isPinned()) pinned.releaseLater();
	});

	const release = useEffectEvent(forgetAim);

	useEffect(() => {
		const scroller = scrollerRef.current;
		const content = contentRef.current;
		if (!scroller || !content) return;

		return watchScroller(scroller, content, {
			onScrollEnd: settle,
			onUserScroll: release,
			onContentResize: followResize,
		});
	}, [scrollerRef, contentRef]);

	function scrollToIndex(index: number, behavior: ScrollBehavior) {
		const scroller = scrollerRef.current;
		const card = cardAt(cardsRef.current, index);
		if (!scroller || !card) return;

		const top = offsetWithin(scroller, card);
		aimedIndexRef.current = index;
		pinned.pin(index);
		scroller.scrollTo({ top, behavior: withinReach(scroller, top, behavior) });
	}

	function scrollToTop(behavior: ScrollBehavior) {
		forgetAim();
		scrollerRef.current?.scrollTo({ top: 0, behavior });
	}

	return { aimedIndexRef, scrollToIndex, scrollToTop };
}

function watchScroller(
	scroller: HTMLElement,
	content: HTMLElement,
	{ onScrollEnd, onUserScroll, onContentResize }: ScrollerReactions,
): () => void {
	scroller.addEventListener("scrollend", onScrollEnd);
	for (const type of USER_SCROLL_EVENTS) {
		scroller.addEventListener(type, onUserScroll, { passive: true });
	}
	const resizes = new ResizeObserver(onContentResize);
	resizes.observe(content);

	return () => {
		scroller.removeEventListener("scrollend", onScrollEnd);
		for (const type of USER_SCROLL_EVENTS) {
			scroller.removeEventListener(type, onUserScroll);
		}
		resizes.disconnect();
	};
}

function withinReach(
	scroller: HTMLElement,
	top: number,
	behavior: ScrollBehavior,
): ScrollBehavior {
	const reach = scroller.clientHeight * SMOOTH_REACH_IN_VIEWPORTS;

	return Math.abs(top - scroller.scrollTop) > reach ? "instant" : behavior;
}
