import { describe, expect, test } from "bun:test";
import { createQueryClient } from "#/lib/query/queryClient.ts";

describe("createQueryClient", () => {
	test("gives every caller its own cache, so server renders share nothing", () => {
		const first = createQueryClient();
		first.setQueryData(["versions", "npm", "left-pad"], ["1.3.0"]);

		expect(
			createQueryClient().getQueryData(["versions", "npm", "left-pad"]),
		).toBeUndefined();
	});

	test("retries once and leaves a window regaining focus alone", () => {
		expect(createQueryClient().getDefaultOptions().queries).toMatchObject({
			retry: 1,
			refetchOnWindowFocus: false,
		});
	});
});
