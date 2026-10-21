import { describe, expect, test } from "bun:test";
import { fixCommitOf } from "#/lib/vulnerabilities/fixCommitReference.ts";

const SHA = "c4847ebe7d14540bb28a8b932a9ce1b9ecbfee1a";

describe("fixCommitOf", () => {
	test("reads a commit link", () => {
		expect(
			fixCommitOf(`https://github.com/lodash/lodash/commit/${SHA}`),
		).toEqual({ owner: "lodash", repo: "lodash", sha: SHA });
	});

	test("reads a commit inside a pull request", () => {
		expect(
			fixCommitOf("https://github.com/lodash/lodash/pull/5065/commits/02906b8"),
		).toEqual({ owner: "lodash", repo: "lodash", sha: "02906b8" });
	});

	test("allows a trailing slash, a query and a fragment", () => {
		for (const suffix of ["/", "?diff=split", "#diff-1"]) {
			expect(
				fixCommitOf(`https://github.com/a/b.js/commit/abc1234${suffix}`),
			).toEqual({ owner: "a", repo: "b.js", sha: "abc1234" });
		}
	});

	test.each([
		"https://github.com.evil.example/a/b/commit/abc1234",
		"https://evil.example/github.com/a/b/commit/abc1234",
		"https://user@github.com/a/b/commit/abc1234",
		"https://github.com:8443/a/b/commit/abc1234",
		"http://github.com/a/b/commit/abc1234",
		"https://github.com/a/../b/commit/abc1234",
		"https://github.com/../b/commit/abc1234",
		"https://github.com/a/../commit/abc1234",
		"https://github.com/a/b/commit/x",
		"https://github.com/a/b/commit/ABC1234",
		"https://github.com/a/b/commit/abc12",
		"https://github.com/a/b/commit/abc1234/../../evil",
		"https://github.com/a%2fb/c/commit/abc1234",
		"https://github.com/a/b/pull/12",
		"https://github.com/a/b",
		"",
	])("rejects %s", (url) => {
		expect(fixCommitOf(url)).toBeNull();
	});
});
