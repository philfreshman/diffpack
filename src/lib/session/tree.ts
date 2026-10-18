import type { DiffFileEntry } from "#/lib/worker/protocol.ts";

export function flattenFiles(tree: DiffFileEntry | null): DiffFileEntry[] {
	if (!tree) return [];
	if (tree.type === "file") return [tree];

	return (tree.children ?? []).flatMap(flattenFiles);
}

// The URL carries only a renamed file's new path; this recovers its `oldPath`.
export function findFile(
	tree: DiffFileEntry | null,
	path: string,
): DiffFileEntry | undefined {
	if (!path) return undefined;

	return flattenFiles(tree).find((entry) => entry.path === path);
}

export function changedFiles(tree: DiffFileEntry | null): DiffFileEntry[] {
	return flattenFiles(tree).filter((entry) => entry.status !== "unchanged");
}

export function countChangedFiles(tree: DiffFileEntry | null): number {
	return changedFiles(tree).length;
}
