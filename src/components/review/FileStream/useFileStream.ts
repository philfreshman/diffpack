import { useRef } from "react";
import type { DiffFileEntry } from "#/lib/worker/protocol.ts";
import { useStreamNavigation } from "./useStreamNavigation.ts";
import { useStreamShortcuts } from "./useStreamShortcuts.ts";

export function useFileStream(
	files: readonly DiffFileEntry[],
	viewed: ReadonlySet<string>,
	onViewedChange: (path: string, viewed: boolean) => void,
	onCurrentFileChange: (path: string | null) => void,
) {
	const scrollerRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const cardsRef = useRef<HTMLDivElement>(null);
	const navigation = useStreamNavigation(
		files,
		{ scrollerRef, contentRef, cardsRef },
		onCurrentFileChange,
	);

	function changeViewed(path: string, isViewed: boolean) {
		if (isViewed) navigation.keepPlace(path);
		onViewedChange(path, isViewed);
	}

	useStreamShortcuts(files, viewed, navigation, changeViewed);

	return { scrollerRef, contentRef, cardsRef, navigation, changeViewed };
}
