import { describe, expect, test } from "bun:test";
import { compareAdvisories } from "#/lib/vulnerabilities/report.ts";
import { advisory } from "./advisoryStub.ts";

function changes(report: ReturnType<typeof compareAdvisories>) {
	return report.entries.map(({ advisory, change }) => [advisory.id, change]);
}

describe("compareAdvisories", () => {
	test("sorts each advisory by what the update did to it", () => {
		const report = compareAdvisories(
			[advisory({ id: "A" }), advisory({ id: "B" })],
			[advisory({ id: "B" }), advisory({ id: "C" })],
		);

		expect(changes(report)).toEqual([
			["C", "introduced"],
			["B", "remaining"],
			["A", "fixed"],
		]);
		expect(report.fromCount).toBe(2);
		expect(report.toCount).toBe(2);
	});

	test("recognizes one vulnerability under an alias", () => {
		const report = compareAdvisories(
			[advisory({ id: "PYSEC-1", aliases: ["CVE-1"] })],
			[advisory({ id: "GHSA-1", aliases: ["CVE-1"] })],
		);

		expect(changes(report)).toEqual([["GHSA-1", "remaining"]]);
	});

	test("orders by severity, most severe first, then by id", () => {
		const report = compareAdvisories(
			[],
			[
				advisory({ id: "D", severity: "low" }),
				advisory({ id: "C", severity: "unknown" }),
				advisory({ id: "B", severity: "critical" }),
				advisory({ id: "A", severity: "low" }),
				advisory({ id: "E", severity: "moderate" }),
			],
		);

		expect(report.entries.map(({ advisory }) => advisory.id)).toEqual([
			"B",
			"E",
			"A",
			"D",
			"C",
		]);
	});

	test("reports nothing when neither version has an advisory", () => {
		expect(compareAdvisories([], [])).toEqual({
			fromCount: 0,
			toCount: 0,
			entries: [],
		});
	});
});
