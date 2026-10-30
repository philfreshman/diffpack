import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
	cardTops,
	fileUnderBar,
	NO_FILE,
} from "#/components/review/streamGeometry.ts";
import type { DiffFileEntry } from "#/lib/worker/protocol.ts";
import type { StreamRefs } from "./streamRefs.ts";

export function useScrollSpy(
	files: readonly DiffFileEntry[],
	{ scrollerRef, contentRef, cardsRef, barRef }: StreamRefs,
	onCurrentFileChange: (path: string | null) => void,
): number {
	const [currentIndex, setCurrentIndex] = useState(NO_FILE);
	const reportedPathRef = useRef<string | null>(null);

	const report = useEffectEvent((index: number) => {
		setCurrentIndex(index);
		const path = files[index]?.path ?? null;
		if (path === reportedPathRef.current) return;
		reportedPathRef.current = path;
		onCurrentFileChange(path);
	});

	useEffect(() => {
		const scroller = scrollerRef.current;
		const content = contentRef.current;
		const cards = cardsRef.current;
		if (!scroller || !content || !cards) return;

		let tops: number[] = [];
		let frame = 0;
		const spy = () => {
			frame = 0;
			report(fileUnderBar(scroller, barRef.current, tops));
		};
		const scheduleSpy = () => {
			if (frame === 0) frame = requestAnimationFrame(spy);
		};
		const remeasure = () => {
			tops = cardTops(scroller, cards);
			scheduleSpy();
		};

		const resizes = new ResizeObserver(remeasure);
		resizes.observe(content);
		scroller.addEventListener("scroll", scheduleSpy, { passive: true });
		remeasure();

		return () => {
			cancelAnimationFrame(frame);
			resizes.disconnect();
			scroller.removeEventListener("scroll", scheduleSpy);
		};
	}, [files, scrollerRef, contentRef, cardsRef, barRef]);

	return currentIndex;
}
