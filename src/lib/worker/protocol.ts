/**
 * Wire types shared by the diff worker and its client, and the one rule for
 * when two comparisons are the same.
 */

export type DiffStatus =
	| "added"
	| "removed"
	| "modified"
	| "unchanged"
	| "renamed";

export type DiffFileEntry = {
	path: string;
	oldPath?: string;
	type: "file" | "directory";
	status: DiffStatus;
	added?: number;
	removed?: number;
	children?: DiffFileEntry[];
};

export type FileDiff = {
	data: string;
	isDiff: boolean;
};

export type DiffRequest = {
	registry: string;
	pkg: string;
	from: string;
	to: string;
};

/**
 * A comparison is the pair of versions *and* the question asked of them:
 * whether whitespace counts changes which lines differ, so it is part of what
 * is being read, not a way of showing what has already been read.
 *
 * It is what a `build-tree` asks for, and the engine holds one of them at a
 * time — so the session, the client and the boot script all have to agree on
 * when two are the same one, and {@link comparisonKey} is that agreement.
 */
export type Comparison = DiffRequest & { ignoreWhitespace: boolean };

/** Two comparisons are the same one exactly when this string matches. */
export function comparisonKey(comparison: Comparison): string {
	return [
		comparison.registry,
		comparison.pkg,
		comparison.from,
		comparison.to,
		String(comparison.ignoreWhitespace),
	].join("\n");
}

/**
 * `ignoreWhitespace` rides the two calls that diff and not the one that
 * downloads: prefetch only warms the archives, and the same two serve either
 * answer — a flag there would split one set of downloads into two.
 */
export type WorkerRequest =
	| ({ id: number; type: "build-tree" } & Comparison)
	| ({ id: number; type: "prefetch" } & DiffRequest)
	| {
			id: number;
			type: "get-file";
			path: string;
			oldPath?: string;
			ignoreWhitespace: boolean;
	  };

/** `Omit` over a union must distribute, or the per-variant fields are lost. */
export type WorkerRequestInput = WorkerRequest extends infer T
	? T extends { id: number }
		? Omit<T, "id">
		: never
	: never;

export type WorkerResponse =
	| { id: number; ok: true; data: unknown }
	| { id: number; ok: false; error: string };
