import { describe, expect, test } from "bun:test";
import { CodedError, failureOf, isProxyLimit } from "#/lib/failure/failure.ts";

function engineError(
	message: string,
	properties: Record<string, unknown>,
): Error {
	return Object.assign(new Error(message), properties);
}

describe("failureOf an Error", () => {
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

	test("drops a code it does not know, and fields of the wrong type", () => {
		const thrown = engineError("Refused", {
			code: "origin_not_allowed",
			resetsAt: 0,
			status: "403",
		});

		expect(failureOf(thrown)).toEqual({ message: "Refused" });
	});
});

describe("failureOf anything else thrown", () => {
	test("takes a thrown string as the message", () => {
		expect(failureOf("Package not found")).toEqual({
			message: "Package not found",
		});
	});

	test("reads a plain object's message and code, not its string form", () => {
		const thrown = {
			message: "diffpack couldn't reach its proxy",
			code: "proxy_unreachable",
		};

		expect(failureOf(thrown)).toEqual({
			message: "diffpack couldn't reach its proxy",
			code: "proxy_unreachable",
		});
	});

	test("keeps the code of a plain object with no message", () => {
		expect(failureOf({ code: "not_found", status: 404 })).toEqual({
			message: "[object Object]",
			code: "not_found",
			status: 404,
		});
	});

	test("survives nothing being thrown at all", () => {
		expect(failureOf(undefined)).toEqual({ message: "undefined" });
	});
});

describe("isProxyLimit", () => {
	test("is true only for the proxy being paused or out of reach", () => {
		expect(isProxyLimit("quota_exhausted")).toBe(true);
		expect(isProxyLimit("proxy_unreachable")).toBe(true);
		expect(isProxyLimit("not_found")).toBe(false);
		expect(isProxyLimit(null)).toBe(false);
	});
});

describe("CodedError", () => {
	test("names itself in stack traces and logs", () => {
		const error = new CodedError({
			message: "Paused",
			code: "quota_exhausted",
		});

		expect(error.name).toBe("CodedError");
		expect(String(error)).toBe("CodedError: Paused");
	});
});
