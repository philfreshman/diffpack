import { type RefObject, useEffect, useEffectEvent, useRef } from "react";

/**
 * A ref, not state, so scrolling never re-renders the list, and not read from
 * the element at unmount, where a detached scroller reports zero.
 */
export function useScrollMemory(
	scrollTop: number,
	onScrolled: (scrollTop: number) => void,
): RefObject<number> {
	const remember = useEffectEvent(onScrolled);

	const at = useRef(scrollTop);
	useEffect(() => () => remember(at.current), []);

	return at;
}
