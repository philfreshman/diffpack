import { useEffect, useRef } from "react";
import {
	isOffTarget,
	offsetWithin,
} from "#/components/review/streamGeometry.ts";
import type { StreamRefs } from "./streamRefs.ts";

const PIN_RELEASE_DELAY_MS = 1500;

interface PinnedCard {
	pin(index: number): void;
	unpin(): void;
	isPinned(): boolean;
	releaseLater(): void;
	realign(behavior: ScrollBehavior): void;
}

export function usePinnedCard({
	scrollerRef,
	cardsRef,
}: Pick<StreamRefs, "scrollerRef" | "cardsRef">): PinnedCard {
	const pinnedIndexRef = useRef<number | null>(null);
	const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(
		() => () => {
			if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
		},
		[],
	);

	return {
		pin(index) {
			pinnedIndexRef.current = index;
		},
		unpin() {
			pinnedIndexRef.current = null;
		},
		isPinned() {
			return pinnedIndexRef.current !== null;
		},
		releaseLater() {
			if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
			releaseTimerRef.current = setTimeout(() => {
				pinnedIndexRef.current = null;
			}, PIN_RELEASE_DELAY_MS);
		},
		realign(behavior) {
			const scroller = scrollerRef.current;
			const pinned = pinnedIndexRef.current;
			const card = pinned === null ? null : cardAt(cardsRef.current, pinned);
			if (!scroller || !card) return;

			const target = offsetWithin(scroller, card);
			if (isOffTarget(scroller, target))
				scroller.scrollTo({ top: target, behavior });
		},
	};
}

export function cardAt(
	cards: HTMLElement | null,
	index: number,
): Element | null {
	return cards?.children.item(index) ?? null;
}
