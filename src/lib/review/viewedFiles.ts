import type { DiffRequest } from "#/lib/worker/protocol.ts";

export interface ReviewedComparison {
	id: string;
	paths: readonly string[];
}

export type ViewedLog = readonly ReviewedComparison[];

export const REVIEW_LIMIT = 50;

const NOTHING_VIEWED: ReadonlySet<string> = new Set();

export function reviewId({ registry, pkg, from, to }: DiffRequest): string {
	return [registry, pkg, from, to].join("\n");
}

function isReviewedComparison(value: unknown): value is ReviewedComparison {
	if (typeof value !== "object" || value === null) return false;
	const { id, paths } = value as Partial<ReviewedComparison>;

	return (
		typeof id === "string" &&
		Array.isArray(paths) &&
		paths.every((path) => typeof path === "string")
	);
}

export function parseViewedLog(raw: string | null): ViewedLog {
	if (!raw) return [];

	try {
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(isReviewedComparison).slice(0, REVIEW_LIMIT);
	} catch {
		return [];
	}
}

export function viewedIn(log: ViewedLog, id: string): ReadonlySet<string> {
	const review = log.find((entry) => entry.id === id);

	return review ? new Set(review.paths) : NOTHING_VIEWED;
}

export function withViewed(
	log: ViewedLog,
	id: string,
	path: string,
	viewed: boolean,
): ViewedLog {
	const others = log.filter((entry) => entry.id !== id);
	const kept = [...viewedIn(log, id)].filter((it) => it !== path);
	const paths = viewed ? [...kept, path] : kept;
	if (paths.length === 0) return others;

	return [{ id, paths }, ...others].slice(0, REVIEW_LIMIT);
}
