import { describe, expect, test } from "bun:test";
import type { OpenFile } from "#/lib/session/diffSession.ts";
import { type ShownFile, shownFile } from "#/lib/session/shownFile.ts";

const MANIFEST: ShownFile = {
	path: "package.json",
	diff: { data: "- 1\n+ 2", isDiff: true },
};

const NO_FAILURE = { error: null, errorCode: null, resetsAt: null };

function opening(path: string): OpenFile {
	return { path, status: "loading", diff: null, ...NO_FAILURE };
}

describe("shownFile", () => {
	test("shows the file the URL names once it has its diff", () => {
		expect(
			shownFile(null, {
				path: "package.json",
				status: "ready",
				diff: MANIFEST.diff,
				...NO_FAILURE,
			}),
		).toEqual(MANIFEST);
	});

	test("keeps the file being read while the next one is fetched", () => {
		expect(shownFile(MANIFEST, opening("lib/view.js"))).toEqual(MANIFEST);
	});

	test("has nothing to hold on to on the first file of a comparison", () => {
		expect(shownFile(null, opening("package.json"))).toBeNull();
	});

	test("lets go when the file is closed or fails", () => {
		expect(shownFile(MANIFEST, null)).toBeNull();
		expect(
			shownFile(MANIFEST, {
				path: "lib/view.js",
				status: "error",
				diff: null,
				...NO_FAILURE,
				error: "gone",
			}),
		).toBeNull();
	});
});
