import { describe, expect, test } from "bun:test";
import { formatResetTime, nextUtcMidnight } from "#/lib/failure/resetTime.ts";

const RESET = "2026-10-20T00:00:00Z";

describe("formatResetTime", () => {
	test("shows the reset in the reader's time zone, named", () => {
		expect(formatResetTime(RESET, "en-US", "America/New_York")).toBe(
			"8:00 PM EDT",
		);
		expect(formatResetTime(RESET, "de-DE", "Europe/Berlin")).toBe("02:00 MESZ");
	});

	test("keeps a zone's half hour", () => {
		expect(formatResetTime(RESET, "en-GB", "Asia/Kolkata")).toStartWith(
			"05:30",
		);
	});

	test("reads midnight as midnight where the reader's clock is on UTC", () => {
		expect(formatResetTime(RESET, "en-US", "UTC")).toBe("12:00 AM UTC");
		expect(
			formatResetTime("2026-12-01T00:00:00Z", "en-GB", "Europe/London"),
		).toBe("00:00 GMT");
	});
});

describe("formatResetTime without a usable reset", () => {
	const NOW = new Date("2026-10-19T15:42:10Z");

	test("falls back to the next 00:00 UTC for a value that is not a date", () => {
		expect(formatResetTime("tomorrow-ish", "en-US", "UTC", NOW)).toBe(
			"12:00 AM UTC",
		);
	});

	test("falls back to the next 00:00 UTC when there is none", () => {
		expect(formatResetTime(undefined, "en-US", "America/New_York", NOW)).toBe(
			"8:00 PM EDT",
		);
	});
});

describe("nextUtcMidnight", () => {
	test("is the coming 00:00 UTC", () => {
		expect(nextUtcMidnight(new Date("2026-10-19T15:42:10Z"))).toBe(
			"2026-10-20T00:00:00.000Z",
		);
	});

	test("is tomorrow's a moment before midnight", () => {
		expect(nextUtcMidnight(new Date("2026-10-19T23:59:59.999Z"))).toBe(
			"2026-10-20T00:00:00.000Z",
		);
	});

	test("is tomorrow's at midnight itself, since today's has passed", () => {
		expect(nextUtcMidnight(new Date("2026-10-20T00:00:00Z"))).toBe(
			"2026-10-21T00:00:00.000Z",
		);
	});

	test("crosses into the next month and year", () => {
		expect(nextUtcMidnight(new Date("2026-12-31T08:00:00Z"))).toBe(
			"2027-01-01T00:00:00.000Z",
		);
	});
});
