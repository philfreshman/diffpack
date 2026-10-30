import { useState } from "react";
import type { LineRange } from "#/lib/diff/computeVisibility.ts";
import { type FileModel, fileModel } from "#/lib/diff/fileModel.ts";
import {
	emptyMemory,
	fileView,
	withExpandAll,
	withRevealed,
} from "#/lib/diff/viewMemory.ts";
import type { FileLoad } from "./useFileLoad.ts";

const LARGE_FILE_ROWS = 1500;

export interface CardModel {
	model: FileModel | null;
	gated: boolean;
	expandAll: boolean | null;
	acceptLarge(): void;
	setExpandAll(expandAll: boolean): void;
	reveal(range: LineRange): void;
}

export function useCardModel(
	path: string,
	load: FileLoad,
	split: boolean,
): CardModel {
	const [memory, setMemory] = useState(emptyMemory);
	const [largeAccepted, setLargeAccepted] = useState(false);
	const model =
		load.state === "ready"
			? fileModel(load.file, fileView(memory, path), split)
			: null;

	return {
		model,
		gated: !largeAccepted && isLarge(model),
		expandAll: hasRows(model) ? model.expandAll : null,
		acceptLarge: () => setLargeAccepted(true),
		setExpandAll: (expandAll) =>
			setMemory((it) => withExpandAll(it, path, expandAll)),
		reveal: (range) => setMemory((it) => withRevealed(it, path, range)),
	};
}

function hasRows(model: FileModel | null): model is FileModel {
	return model !== null && model.rows.length > 0;
}

function isLarge(model: FileModel | null): boolean {
	return model !== null && model.rows.length > LARGE_FILE_ROWS;
}
