import { describe, expect, test } from "bun:test";
import { advisoryFrom } from "#/lib/vulnerabilities/advisory.ts";
import lodashRedos from "./fixtures/GHSA-29mw-wpgm-hmr9.json" with {
	type: "json",
};
import goHtml from "./fixtures/GO-2023-1988.json" with { type: "json" };
import tokioAbort from "./fixtures/RUSTSEC-2021-0072.json" with {
	type: "json",
};

describe("a GitHub advisory for npm", () => {
	const advisory = advisoryFrom(lodashRedos, "lodash");

	test("keeps the id, the aliases, the summary and a link to osv.dev", () => {
		expect(advisory.id).toBe("GHSA-29mw-wpgm-hmr9");
		expect(advisory.aliases).toEqual(["CVE-2020-28500"]);
		expect(advisory.summary).toBe(
			"Regular Expression Denial of Service (ReDoS) in lodash",
		);
		expect(advisory.url).toBe(
			"https://osv.dev/vulnerability/GHSA-29mw-wpgm-hmr9",
		);
	});

	test("reads the severity GitHub rated it", () => {
		expect(advisory.severity).toBe("moderate");
	});

	test("takes the fixed versions from the entry for this package only", () => {
		expect(advisory.fixedIn).toEqual(["4.17.21"]);
	});

	test("collects the GitHub commits the references point at, once each", () => {
		expect(advisory.hints.fixCommits).toEqual([
			{
				owner: "lodash",
				repo: "lodash",
				sha: "02906b8191d3c100c193fe6f7b27d1c40f200bb7",
			},
			{
				owner: "lodash",
				repo: "lodash",
				sha: "c4847ebe7d14540bb28a8b932a9ce1b9ecbfee1a",
			},
		]);
	});
});

describe("a Go advisory", () => {
	const advisory = advisoryFrom(goHtml, "golang.org/x/net");

	test("keeps the vulnerable package and its symbols", () => {
		expect(advisory.hints.goImports).toEqual([
			{ path: "golang.org/x/net/html", symbols: ["Render", "render1"] },
		]);
		expect(advisory.fixedIn).toEqual(["0.13.0"]);
	});

	test("has no severity when the record carries no rating", () => {
		expect(advisory.severity).toBe("unknown");
	});

	test("takes no hints from an entry for another module", () => {
		expect(advisoryFrom(goHtml, "golang.org/x/text").hints.goImports).toEqual(
			[],
		);
	});
});

describe("a RustSec advisory", () => {
	const advisory = advisoryFrom(tokioAbort, "tokio");

	test("keeps the affected functions", () => {
		expect(advisory.hints.functions).toEqual([
			"tokio::task::JoinHandle::abort",
		]);
	});

	test("lists every fixed version of every range", () => {
		expect(advisory.fixedIn.length).toBeGreaterThan(1);
	});
});

describe("an incomplete record", () => {
	test("normalizes to empty fields rather than failing", () => {
		expect(
			advisoryFrom({ id: "OSV-1", affected: [{ ranges: 3 }] }, "x"),
		).toEqual({
			id: "OSV-1",
			aliases: [],
			summary: "",
			severity: "unknown",
			url: "https://osv.dev/vulnerability/OSV-1",
			fixedIn: [],
			hints: { goImports: [], functions: [], fixCommits: [] },
		});
		expect(advisoryFrom(null, "x").id).toBe("");
	});

	test("falls back to the first line of the details for a summary", () => {
		const record = { id: "PYSEC-1", details: "Jinja is unsafe.\nMore here." };
		expect(advisoryFrom(record, "jinja2").summary).toBe("Jinja is unsafe.");
	});

	test("matches a PyPI name however it is spelled", () => {
		const record = {
			id: "PYSEC-2",
			affected: [
				{
					package: { name: "Zope.Interface", ecosystem: "PyPI" },
					ranges: [{ type: "ECOSYSTEM", events: [{ fixed: "5.0" }] }],
				},
			],
		};
		expect(advisoryFrom(record, "zope-interface").fixedIn).toEqual(["5.0"]);
	});

	test("ignores fixed commits of a git range", () => {
		const record = {
			id: "OSV-2",
			affected: [
				{
					package: { name: "x", ecosystem: "npm" },
					ranges: [{ type: "GIT", events: [{ fixed: "abc1234" }] }],
				},
			],
		};
		expect(advisoryFrom(record, "x").fixedIn).toEqual([]);
	});
});
