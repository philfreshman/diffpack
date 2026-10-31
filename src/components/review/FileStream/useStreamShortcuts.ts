import { useKeyShortcut } from "#/components/ui/useKeyShortcut.ts";
import { nextUnviewed } from "#/lib/review/fileStream.ts";
import type { DiffFileEntry } from "#/lib/worker/protocol.ts";
import type { StreamNavigation } from "./useStreamNavigation.ts";

export function useStreamShortcuts(
	files: readonly DiffFileEntry[],
	viewed: ReadonlySet<string>,
	navigation: StreamNavigation,
	onViewedChange: (path: string, viewed: boolean) => void,
) {
	const current = files[navigation.currentIndex];

	useKeyShortcut("j", () => navigation.stepFile(1));
	useKeyShortcut("k", () => navigation.stepFile(-1));
	useKeyShortcut("n", () => {
		const upNext = nextUnviewed(files, viewed, navigation.currentIndex);
		if (upNext) navigation.scrollToFile(upNext.path);
	});
	useKeyShortcut("v", () => {
		if (current) onViewedChange(current.path, !viewed.has(current.path));
	});
}
