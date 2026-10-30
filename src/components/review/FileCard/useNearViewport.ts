import { type RefObject, useEffect, useState } from "react";

const ONE_VIEWPORT_AROUND = "100% 0px";

export function useNearViewport(
	elementRef: RefObject<HTMLElement | null>,
	scrollerRef: RefObject<HTMLElement | null>,
): boolean {
	const [near, setNear] = useState(false);

	useEffect(() => {
		const element = elementRef.current;
		if (!element) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const latest = entries.at(-1);
				if (latest) setNear(latest.isIntersecting);
			},
			{ root: scrollerRef.current, rootMargin: ONE_VIEWPORT_AROUND },
		);
		observer.observe(element);

		return () => observer.disconnect();
	}, [elementRef, scrollerRef]);

	return near;
}
