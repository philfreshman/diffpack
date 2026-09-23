import { useMemo } from "react";
import { type FileModel, fileModel, parseFile } from "#/lib/diff/fileModel.ts";
import type { FileView } from "#/lib/diff/viewMemory.ts";
import type { FileDiff } from "#/lib/worker/protocol.ts";

/**
 * The file as a model, derived in one place so the viewer is left with only
 * putting rows on screen.
 *
 * Two memos rather than one: folding and switching layouts do not change what
 * the file says, so it is parsed again only when the file itself changes.
 */
export function useDiffModel(
	path: string,
	file: FileDiff,
	view: FileView,
	split: boolean,
): FileModel {
	const parsed = useMemo(() => parseFile(path, file), [path, file]);

	return useMemo(() => fileModel(parsed, view, split), [parsed, view, split]);
}
