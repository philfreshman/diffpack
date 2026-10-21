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

	test("merges records that are linked only through a later one", () => {
		const collapsed = collapseAliases([
			advisory({ id: "X", aliases: ["CVE-1"] }),
			advisory({ id: "Y", aliases: ["CVE-2"] }),
			advisory({ id: "Z", aliases: ["CVE-1", "CVE-2"] }),
		]);

		expect(collapsed.map(({ id }) => id)).toEqual(["X"]);
		expect(collapsed[0]?.aliases).toEqual(
			expect.arrayContaining(["CVE-1", "CVE-2", "Y", "Z"]),
		);
	});

	test("keeps the first record as the lead when both are rated the same", () => {
		const [lead] = collapseAliases([
			advisory({ id: "A", aliases: ["CVE-1"], severity: "low" }),
			advisory({ id: "B", aliases: ["CVE-1"], severity: "low" }),
		]);
		expect(lead?.id).toBe("A");
	});

	test("keeps a more severe first record as the lead", () => {
		const [lead] = collapseAliases([
			advisory({ id: "A", aliases: ["CVE-1"], severity: "critical" }),
			advisory({ id: "B", aliases: ["CVE-1"], severity: "low" }),
		]);
		expect(lead).toMatchObject({ id: "A", severity: "critical" });
	});
});
