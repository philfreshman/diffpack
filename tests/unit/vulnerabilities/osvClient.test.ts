import { describe, expect, test } from "bun:test";
import { createOsvClient, osvClient } from "#/lib/vulnerabilities/osvClient.ts";
import { json, stubFetch } from "../registries/fetchStub.ts";
import jinjaGithub from "./fixtures/GHSA-462w-v97r-4m45.json" with { type: "json" };
import goHtml from "./fixtures/GO-2023-1988.json" with { type: "json" };
import jinjaPysec from "./fixtures/PYSEC-2019-217.json" with { type: "json" };

const QUERY_URL = "https://api.osv.dev/v1/query";

function bodyOf(init: RequestInit | undefined): unknown {
	return JSON.parse(String(init?.body));
}

describe("the OSV.dev client's request", () => {
	test("posts the package, its ecosystem and the version to the query endpoint", async () => {
		const { fetcher, calls } = stubFetch(() => json({}));
		const signal = new AbortController().signal;

		await createOsvClient(fetcher).query(
			"go",
			"golang.org/x/net",
			"v0.12.0",
			signal,
		);

		expect(calls).toHaveLength(1);
		expect(calls[0]?.url).toBe(QUERY_URL);
		expect(calls[0]?.init?.method).toBe("POST");
		expect(calls[0]?.signal).toBe(signal);
		expect(bodyOf(calls[0]?.init)).toEqual({
			package: { name: "golang.org/x/net", ecosystem: "Go" },
			version: "v0.12.0",
		});
	});

	test("keeps hostile names in the body and every request on api.osv.dev", async () => {
		const { fetcher, calls } = stubFetch(() => json({}));
		const client = createOsvClient(fetcher);

		for (const name of [
			"https://evil.example/x",
			"../../x",
			"//evil.example",
		]) {
			await client.query("npm", name, "../1.0.0");
		}

		for (const call of calls) expect(call.url).toBe(QUERY_URL);
	});
});

describe("the OSV.dev client, across pages", () => {
	test("follows the page token until the last page", async () => {
		const pages = [
			{ vulns: [goHtml], next_page_token: "second" },
			{ vulns: [{ ...goHtml, id: "GO-2", aliases: [] }] },
		];
		const { fetcher, calls } = stubFetch(() => json(pages[calls.length - 1]));

		const advisories = await createOsvClient(fetcher).query(
			"go",
			"golang.org/x/net",
			"0.12.0",
		);

		expect(advisories.map(({ id }) => id)).toEqual(["GO-2023-1988", "GO-2"]);
		expect(bodyOf(calls[1]?.init)).toMatchObject({ page_token: "second" });
		expect(bodyOf(calls[0]?.init)).not.toHaveProperty("page_token");
	});

	test("sends the signal with every page", async () => {
		const pages = [{ next_page_token: "second" }, {}];
		const { fetcher, calls } = stubFetch(() => json(pages[calls.length - 1]));
		const signal = new AbortController().signal;

		await createOsvClient(fetcher).query("npm", "x", "1.0.0", signal);

		expect(calls.map((call) => call.signal)).toEqual([signal, signal]);
	});

	test("fails rather than answering a partial list when the pages never end", async () => {
		const { fetcher, calls } = stubFetch(() =>
			json({ vulns: [goHtml], next_page_token: "more" }),
		);

		await expect(
			createOsvClient(fetcher).query("go", "golang.org/x/net", "0.12.0"),
		).rejects.toThrow("OSV.dev");
		expect(calls).toHaveLength(20);
	});
});

describe("the OSV.dev client's answer", () => {
	test("answers an empty list when nothing is known", async () => {
		const { fetcher } = stubFetch(() => json({}));
		expect(await createOsvClient(fetcher).query("npm", "x", "1.0.0")).toEqual(
			[],
		);
	});

	test("folds records that are one vulnerability into the rated one", async () => {
		const { fetcher } = stubFetch(() =>
			json({ vulns: [jinjaPysec, jinjaGithub] }),
		);

		const [advisory, ...rest] = await createOsvClient(fetcher).query(
			"pypi",
			"Jinja2",
			"2.10",
		);

		expect(rest).toEqual([]);
		expect(advisory?.id).toBe("GHSA-462w-v97r-4m45");
		expect(advisory?.severity).toBe("high");
		expect(advisory?.aliases).toContain("PYSEC-2019-217");
		expect(advisory?.aliases).not.toContain("GHSA-462w-v97r-4m45");
		expect(advisory?.fixedIn).toEqual(["2.10.1"]);
	});

	test("fails when OSV.dev answers with an error", async () => {
		const { fetcher } = stubFetch(() => json({ message: "bad" }, 400));
		await expect(
			createOsvClient(fetcher).query("npm", "x", "1"),
		).rejects.toThrow("OSV.dev");
	});
});

describe("the app's OSV.dev client", () => {
	test("gives up at once when the lookup was cancelled before it started", async () => {
		await expect(
			osvClient.query("npm", "left-pad", "1.3.0", AbortSignal.abort()),
		).rejects.toMatchObject({ name: "AbortError" });
	});
});
