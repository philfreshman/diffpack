import { describe, expect, test } from "bun:test";
import type { Failure } from "#/lib/failure/failure.ts";
import {
	archiveFetched,
	BUILT,
	type BuildProgress,
	buildFailed,
	FETCHING,
	failuresOf,
} from "#/lib/session/buildProgress.ts";

const OLD_MISSING: Failure = { message: "404 fetching express@4.18.2" };
const NEW_MISSING: Failure = { message: "404 fetching express@5.1.0" };
const ENGINE_DOWN: Failure = { message: "wasm failed to start" };

function states(progress: BuildProgress) {
	return [progress.from.state, progress.to.state, progress.diff.state];
}

function shownFailures(progress: BuildProgress) {
	return failuresOf(progress).map(({ failure }) => failure);
}

const fromFetched = archiveFetched(FETCHING, { side: "from", failure: null });
const bothFetched = archiveFetched(fromFetched, { side: "to", failure: null });

describe("a build in progress", () => {
	test("fetches both archives before it diffs", () => {
		expect(states(FETCHING)).toEqual(["running", "running", "waiting"]);
	});

	test("diffs only once the second archive is in", () => {
		expect(states(fromFetched)).toEqual(["done", "running", "waiting"]);
		expect(states(bothFetched)).toEqual(["done", "done", "running"]);
	});

	test("is built once both archives are in and diffed", () => {
		expect(states(BUILT)).toEqual(["done", "done", "done"]);
		expect(failuresOf(BUILT)).toEqual([]);
	});

	test("marks only the archive that failed", () => {
		const progress = archiveFetched(FETCHING, {
			side: "to",
			failure: NEW_MISSING,
		});

		expect(states(progress)).toEqual(["running", "failed", "waiting"]);
		expect(shownFailures(progress)).toEqual([NEW_MISSING]);
	});
});

describe("a failed build", () => {
	test("after a failed download, leaves the diff that never ran waiting", () => {
		const fetched = archiveFetched(fromFetched, {
			side: "to",
			failure: NEW_MISSING,
		});
		const progress = buildFailed(fetched, NEW_MISSING);

		expect(states(progress)).toEqual(["done", "failed", "waiting"]);
		expect(shownFailures(progress)).toEqual([NEW_MISSING]);
	});

	test("before any download reported, fails both and says why once", () => {
		const progress = buildFailed(FETCHING, ENGINE_DOWN);

		expect(states(progress)).toEqual(["failed", "failed", "waiting"]);
		expect(shownFailures(progress)).toEqual([ENGINE_DOWN]);
	});

	test("while diffing, fails the diff", () => {
		const progress = buildFailed(bothFetched, ENGINE_DOWN);

		expect(states(progress)).toEqual(["done", "done", "failed"]);
		expect(shownFailures(progress)).toEqual([ENGINE_DOWN]);
	});

	test("with nothing left running, still says why", () => {
		const progress = buildFailed(
			{ ...bothFetched, diff: { state: "done", failure: null } },
			ENGINE_DOWN,
		);

		expect(shownFailures(progress)).toEqual([ENGINE_DOWN]);
	});
});

describe("the failures shown", () => {
	test("list the old version first, whichever failed first", () => {
		const newFirst = archiveFetched(FETCHING, {
			side: "to",
			failure: NEW_MISSING,
		});
		const progress = archiveFetched(newFirst, {
			side: "from",
			failure: OLD_MISSING,
		});

		expect(shownFailures(progress)).toEqual([OLD_MISSING, NEW_MISSING]);
	});

	test("keep two failures of one code apart, each under its own step", () => {
		const missing = (message: string): Failure => ({
			message,
			code: "not_found",
		});
		const progress = archiveFetched(
			archiveFetched(FETCHING, { side: "from", failure: missing("a 404") }),
			{ side: "to", failure: missing("b 404") },
		);

		expect(failuresOf(progress)).toEqual([
			{ step: "from", failure: missing("a 404") },
			{ step: "to", failure: missing("b 404") },
		]);
	});

	test("say the same proxy limit once, however its message differs", () => {
		const quota = (message: string): Failure => ({
			message,
			code: "quota_exhausted",
		});
		const both = archiveFetched(
			archiveFetched(FETCHING, { side: "from", failure: quota("a paused") }),
			{ side: "to", failure: quota("b paused") },
		);

		expect(shownFailures(both)).toEqual([quota("a paused")]);
	});
});
