import { useSetting } from "#/components/storage/useSetting.ts";
import { reviewId, viewedIn, withViewed } from "#/lib/review/viewedFiles.ts";
import { VIEWED_FILES } from "#/lib/storage/settings.ts";
import type { DiffRequest } from "#/lib/worker/protocol.ts";

export interface ViewedFiles {
	viewed: ReadonlySet<string>;
	setViewed(path: string, viewed: boolean): void;
}

const NOTHING_VIEWED: ReadonlySet<string> = new Set();

export function useViewedFiles(request: DiffRequest | null): ViewedFiles {
	const log = useSetting(VIEWED_FILES);
	const id = request ? reviewId(request) : null;

	return {
		viewed: id === null ? NOTHING_VIEWED : viewedIn(log.value, id),
		setViewed(path, viewed) {
			if (id !== null) log.set(withViewed(log.value, id, path, viewed));
		},
	};
}
