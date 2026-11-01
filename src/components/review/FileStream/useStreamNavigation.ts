import {
	hasScrolledPast,
	preferredScrollBehavior,
} from "#/components/review/streamGeometry.ts";
import type { DiffFileEntry } from "#/lib/worker/protocol.ts";
import type { StreamRefs } from "./streamRefs.ts";
import { useScrollAim } from "./useScrollAim.ts";
import { useScrollSpy } from "./useScrollSpy.ts";

export interface StreamNavigation {
	currentIndex: number;
	scrollToFile(path: string): void;
	stepFile(direction: 1 | -1): void;
	keepPlace(path: string): void;
}

export function useStreamNavigation(
	files: readonly DiffFileEntry[],
	refs: StreamRefs,
	onCurrentFileChange: (path: string | null) => void,
): StreamNavigation {
	const currentIndex = useScrollSpy(files, refs, onCurrentFileChange);
	const { aimedIndexRef, scrollToIndex, scrollToTop } = useScrollAim(refs);

	function scrollToFile(path: string) {
		scrollToIndex(indexOf(files, path), preferredScrollBehavior());
	}

	function stepFile(direction: 1 | -1) {
		const to = (aimedIndexRef.current ?? currentIndex) + direction;
		if (to >= files.length) return;
		if (to >= 0) {
			scrollToIndex(to, preferredScrollBehavior());
			return;
		}

		scrollToTop(preferredScrollBehavior());
	}

	function keepPlace(path: string) {
		const scroller = refs.scrollerRef.current;
		const index = indexOf(files, path);
		const card = refs.cardsRef.current?.children.item(index);
		if (!scroller || !card) return;
		if (!hasScrolledPast(scroller, card)) return;

		requestAnimationFrame(() => scrollToIndex(index, "instant"));
	}

	return { currentIndex, scrollToFile, stepFile, keepPlace };
}

function indexOf(files: readonly DiffFileEntry[], path: string): number {
	return files.findIndex((entry) => entry.path === path);
}
