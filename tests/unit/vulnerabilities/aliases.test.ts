import { describe, expect, test } from "bun:test";
import { collapseAliases } from "#/lib/vulnerabilities/aliases.ts";
import { advisory } from "./advisoryStub.ts";

describe("collapseAliases", () => {
	test("keeps advisories that share no name apart", () => {
		const list = [advisory({ id: "A" }), advisory({ id: "B" })];
		expect(collapseAliases(list)).toEqual(list);
	});

	test("merges the hints of both records into the more severe one", () => {
		const commit = { owner: "o", repo: "r", sha: "abc1234" };
		const [merged, ...rest] = collapseAliases([
			advisory({
				id: "PYSEC-1",
				aliases: ["CVE-1"],
				summary: "From PyPI",
				fixedIn: ["1.1"],
				hints: {
					fixCommits: [commit],
					goImports: [{ path: "m/p", symbols: ["A"] }],
				},
			}),
			advisory({
				id: "GHSA-1",
				aliases: ["CVE-1", "PYSEC-1"],
				severity: "high",
				fixedIn: ["1.1", "2.1"],
				hints: {
					fixCommits: [commit],
					goImports: [{ path: "m/p", symbols: ["B"] }],
				},
			}),
		]);

		expect(rest).toEqual([]);
		expect(merged).toMatchObject({
			id: "GHSA-1",
			aliases: ["CVE-1", "PYSEC-1"],
			severity: "high",
			summary: "From PyPI",
			fixedIn: ["1.1", "2.1"],
			hints: {
				fixCommits: [commit],
				goImports: [{ path: "m/p", symbols: ["B", "A"] }],
			},
		});
	});
});
