import { currentFileIndex } from "#/lib/review/fileStream.ts";

export const NO_FILE = -1;

const STUCK_TOLERANCE_PX = 1;

export function offsetWithin(scroller: HTMLElement, element: Element): number {
	const scrollerTop = scroller.getBoundingClientRect().top + scroller.clientTop;

	return element.getBoundingClientRect().top - scrollerTop + scroller.scrollTop;
}

export function cardTops(scroller: HTMLElement, cards: HTMLElement): number[] {
	return Array.from(cards.children, (card) => offsetWithin(scroller, card));
}

function barHeight(bar: HTMLElement | null): number {
	return bar?.offsetHeight ?? 0;
}

export function scrollTopFor(
	scroller: HTMLElement,
	bar: HTMLElement | null,
	card: Element,
): number {
	return offsetWithin(scroller, card) - barHeight(bar);
}

export function fileUnderBar(
	scroller: HTMLElement,
	bar: HTMLElement | null,
	tops: readonly number[],
): number {
	const line = scroller.scrollTop + barHeight(bar) + STUCK_TOLERANCE_PX;
	const first = tops[0];
	if (first === undefined || first > line) return NO_FILE;

	return currentFileIndex(tops, line);
}

export function hasScrolledUnderBar(
	scroller: HTMLElement,
	bar: HTMLElement | null,
	card: Element,
): boolean {
	return (
		scrollTopFor(scroller, bar, card) < scroller.scrollTop - STUCK_TOLERANCE_PX
	);
}

export function isOffTarget(scroller: HTMLElement, target: number): boolean {
	const reachable = Math.min(
		target,
		scroller.scrollHeight - scroller.clientHeight,
	);

	return Math.abs(scroller.scrollTop - reachable) > STUCK_TOLERANCE_PX;
}

export function preferredScrollBehavior(): ScrollBehavior {
	return matchMedia("(prefers-reduced-motion: reduce)").matches
		? "instant"
		: "smooth";
}
