import { type Failure, failureOf } from "#/lib/failure/failure.ts";

/** Rename detection threshold, as a content-similarity ratio. */
export const SIMILARITY_THRESHOLD = 0.75;

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

export type Comparison = DiffRequest & { ignoreWhitespace: boolean };

export function comparisonKey(comparison: Comparison): string {
	return [
		comparison.registry,
		comparison.pkg,
		comparison.from,
		comparison.to,
		String(comparison.ignoreWhitespace),
	].join("\n");
}

// No `ignoreWhitespace` on prefetch: one set of downloads serves both answers.
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

type FailedResponse = { id: number; ok: false; error: string } & Omit<
	Failure,
	"message"
>;

export type WorkerResponse =
	| { id: number; ok: true; data: unknown }
	| FailedResponse;

export type ArchiveSide = "from" | "to";

export interface ArchiveFetched {
	side: ArchiveSide;
	failure: Failure | null;
}

export interface WorkerProgress {
	id: number;
	fetched: ArchiveFetched;
}

export type WorkerMessage = WorkerResponse | WorkerProgress;

export function isProgress(message: WorkerMessage): message is WorkerProgress {
	return "fetched" in message;
}

export type OnArchiveFetched = (fetched: ArchiveFetched) => void;

export function failedReply(id: number, thrown: unknown): FailedResponse {
	const { message, ...details } = failureOf(thrown);
	return { id, ok: false, error: message, ...details };
}
