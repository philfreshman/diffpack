import { describe, expect, test } from "bun:test";
import { moreSevere, severityOf } from "#/lib/vulnerabilities/severity.ts";
import type { Severity } from "#/lib/vulnerabilities/types.ts";

describe("severityOf", () => {
	test.each<[string, Severity]>([
		["CRITICAL", "critical"],
		["HIGH", "high"],
		["MODERATE", "moderate"],
		["MEDIUM", "moderate"],
		["LOW", "low"],
		["high", "high"],
		["", "unknown"],
		["SEVERE", "unknown"],
	])("reads %p as %p", (name, severity) => {
		expect(severityOf(name)).toBe(severity);
	});
});

describe("moreSevere", () => {
	test("picks the higher rating whichever side it is on", () => {
		expect(moreSevere("low", "high")).toBe("high");
		expect(moreSevere("critical", "moderate")).toBe("critical");
	});

	test("ranks any rating above an unknown one", () => {
		expect(moreSevere("unknown", "low")).toBe("low");
	});
});
