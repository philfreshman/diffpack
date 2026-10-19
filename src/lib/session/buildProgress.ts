import { type Failure, isProxyLimit } from "#/lib/failure/failure.ts";
import type { ArchiveFetched } from "#/lib/worker/protocol.ts";

export type StepState = "waiting" | "running" | "done" | "failed";

export interface StepProgress {
	state: StepState;
	failure: Failure | null;
}

export interface BuildProgress {
	from: StepProgress;
	to: StepProgress;
	diff: StepProgress;
}

const RUNNING: StepProgress = { state: "running", failure: null };
const DONE: StepProgress = { state: "done", failure: null };
const WAITING: StepProgress = { state: "waiting", failure: null };

export const FETCHING: BuildProgress = {
	from: RUNNING,
	to: RUNNING,
	diff: WAITING,
};

function failed(failure: Failure): StepProgress {
	return { state: "failed", failure };
}

function bothFetched(progress: BuildProgress): boolean {
	return progress.from.state === "done" && progress.to.state === "done";
}

export function archiveFetched(
	progress: BuildProgress,
	{ side, failure }: ArchiveFetched,
): BuildProgress {
	if (failure) return { ...progress, [side]: failed(failure) };

	const fetched: BuildProgress = { ...progress, [side]: DONE };
	return bothFetched(fetched) ? { ...fetched, diff: RUNNING } : fetched;
}

export function buildFailed(
	progress: BuildProgress,
	failure: Failure,
): BuildProgress {
	const stop = (step: StepProgress) =>
		step.state === "running" ? failed(failure) : step;
	const stopped: BuildProgress = {
		from: stop(progress.from),
		to: stop(progress.to),
		diff: stop(progress.diff),
	};

	if (failuresOf(stopped).length > 0) return stopped;
	return { ...stopped, diff: failed(failure) };
}

function saysTheSame(shown: Failure, next: Failure): boolean {
	if (isProxyLimit(shown.code)) return shown.code === next.code;
	return shown.message === next.message;
}

export function failuresOf(progress: BuildProgress): Failure[] {
	const failures: Failure[] = [];
	for (const { failure } of [progress.from, progress.to, progress.diff]) {
		if (failure && !failures.some((shown) => saysTheSame(shown, failure)))
			failures.push(failure);
	}
	return failures;
}
