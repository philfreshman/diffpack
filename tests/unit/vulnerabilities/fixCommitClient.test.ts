import { describe, expect, test } from "bun:test";
import {
	createFixCommitClient,
	fixCommitsToLookUp,
	MAX_FIX_COMMITS,
} from "#/lib/vulnerabilities/fixCommitClient.ts";
import { json, stubFetch } from "../registries/fetchStub.ts";
import { introduced } from "./advisoryStub.ts";

const COMMIT = {
	owner: "lodash",
	repo: "lodash",
	sha: "c4847ebe7d14540bb28a8b932a9ce1b9ecbfee1a",
};

const PATCH = [
	"@@ -1,5 +1,5 @@",
	" var reWhitespace = /\\s/;",
	"-  while (index-- && reWhitespace.test(string.charAt(index))) {}",
	"+  while (index-- && reWhitespace.test(string.charAt(index))) {",
	"+  }",
	"\\ No newline at end of file",
].join("\n");

describe("the fix commit client", () => {
	test("asks GitHub's API for the commit and reads each file's patch", async () => {
		const { fetcher, calls } = stubFetch(() =>
			json({
				files: [
					{ filename: "lodash.js", patch: PATCH },
					{ filename: "logo.png" },
					{ patch: "+orphan" },
				],
			}),
		);

		const files = await createFixCommitClient(fetcher).files(COMMIT);

		expect(calls.map(({ url }) => url)).toEqual([
			`https://api.github.com/repos/lodash/lodash/commits/${COMMIT.sha}`,
		]);
		expect(files).toEqual([
			{
				filename: "lodash.js",
				removedLines: [
					"  while (index-- && reWhitespace.test(string.charAt(index))) {}",
				],
				addedLines: [
					"  while (index-- && reWhitespace.test(string.charAt(index))) {",
					"  }",
				],
			},
			{ filename: "logo.png", removedLines: [], addedLines: [] },
		]);
	});

	test("answers nothing for a malformed answer", async () => {
		const { fetcher } = stubFetch(() => json({ files: "nope" }));
		expect(await createFixCommitClient(fetcher).files(COMMIT)).toEqual([]);
	});

	test.each([
		{ owner: "..", repo: "x", sha: "abc1234" },
		{ owner: "a", repo: "..", sha: "abc1234" },
		{ owner: "a/b", repo: "c", sha: "abc1234" },
		{ owner: "a", repo: "b?x=", sha: "abc1234" },
		{ owner: "a", repo: "b", sha: "../../../users/x" },
		{ owner: "a", repo: "b", sha: "main" },
	])("refuses $owner/$repo@$sha without a request", async (commit) => {
		const { fetcher, calls } = stubFetch(() => json({ files: [] }));
		await expect(
			createFixCommitClient(fetcher).files(commit),
		).rejects.toThrow();
		expect(calls).toEqual([]);
	});

	test("fails when GitHub refuses, so the caller can ignore it", async () => {
		const { fetcher } = stubFetch(() => json({ message: "rate limit" }, 403));
		await expect(createFixCommitClient(fetcher).files(COMMIT)).rejects.toThrow(
			"GitHub",
		);
	});
});

describe("fixCommitsToLookUp", () => {
	test("takes each commit once, in report order, up to the cap", () => {
		const commits = Array.from({ length: 8 }, (_, index) => ({
			owner: "o",
			repo: "r",
			sha: `abc123${index}`,
		}));
		const entries = [
			introduced({ id: "A", hints: { fixCommits: commits.slice(0, 2) } }),
			introduced({ id: "B", hints: { fixCommits: commits } }),
		];

		expect(fixCommitsToLookUp(entries)).toEqual(
			commits.slice(0, MAX_FIX_COMMITS),
		);
	});
});
