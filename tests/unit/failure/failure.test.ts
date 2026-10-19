import { describe, expect, test } from "bun:test";
import { failureOf } from "#/lib/failure/failure.ts";

function engineError(
	message: string,
	properties: Record<string, unknown>,
): Error {
	return Object.assign(new Error(message), properties);
}

describe("failureOf", () => {
	test("reads the code, reset time and status an engine error carries", () => {
		const thrown = engineError("Composer diffs are paused", {
			code: "quota_exhausted",
			resetsAt: "2026-10-20T00:00:00Z",
			status: 503,
		});

		expect(failureOf(thrown)).toEqual({
			message: "Composer diffs are paused",
			code: "quota_exhausted",
			resetsAt: "2026-10-20T00:00:00Z",
			status: 503,
		});
	});

	test("keeps only the message of an error with no code, as engine 0.4.1 throws", () => {
		expect(failureOf(new Error("Couldn't download"))).toEqual({
			message: "Couldn't download",
		});
	});

	test("takes a thrown string as the message", () => {
		expect(failureOf("Package not found")).toEqual({
			message: "Package not found",
		});
	});

	test("survives nothing being thrown at all", () => {
		expect(failureOf(undefined)).toEqual({ message: "undefined" });
	});

	test("drops a code it does not know, and fields of the wrong type", () => {
		const thrown = engineError("Refused", {
			code: "origin_not_allowed",
			resetsAt: 0,
			status: "403",
		});

		expect(failureOf(thrown)).toEqual({ message: "Refused" });
	});
});
