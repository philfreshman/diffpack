import type { OpenFile } from "#/lib/session/diffSession.ts";
import type { FileDiff } from "#/lib/worker/protocol.ts";

export interface ShownFile {
	path: string;
	diff: FileDiff;
}

// While the next file loads, the previous one stays on screen instead of a spinner.
export function shownFile(
	previous: ShownFile | null,
	open: OpenFile | null,
): ShownFile | null {
	if (open?.diff) return { path: open.path, diff: open.diff };

	return open?.status === "loading" ? previous : null;
}
