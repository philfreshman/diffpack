import { describe, expect, test } from "bun:test";
import {
	parseViewedLog,
	REVIEW_LIMIT,
	reviewId,
	viewedIn,
	withViewed,
} from "#/lib/review/viewedFiles.ts";

const EXPRESS = reviewId({
	registry: "npm",
	pkg: "express",
	from: "4.18.2",
	to: "5.1.0",
});
const SERDE = reviewId({
	registry: "crates",
	pkg: "serde",
	from: "1.0.0",
	to: "1.0.1",
});

describe("reviewId", () => {
	test("tells comparisons apart by every version", () => {
		const other = reviewId({
			registry: "npm",
			pkg: "express",
			from: "4.18.2",
			to: "5.2.0",
		});

		expect(other).not.toBe(EXPRESS);
	});
});

describe("withViewed", () => {
	test("marks a file viewed in its comparison only", () => {
		const log = withViewed([], EXPRESS, "index.js", true);

		expect(viewedIn(log, EXPRESS)).toEqual(new Set(["index.js"]));
		expect(viewedIn(log, SERDE).size).toBe(0);
	});

	test("unmarks a file", () => {
		const marked = withViewed([], EXPRESS, "index.js", true);
		const both = withViewed(marked, EXPRESS, "lib/router.js", true);

		const log = withViewed(both, EXPRESS, "index.js", false);

		expect(viewedIn(log, EXPRESS)).toEqual(new Set(["lib/router.js"]));
	});

	test("does not list a file twice", () => {
		const once = withViewed([], EXPRESS, "index.js", true);

		const log = withViewed(once, EXPRESS, "index.js", true);

		expect(log[0]?.paths).toEqual(["index.js"]);
	});

	test("moves the comparison last touched to the front", () => {
		const express = withViewed([], EXPRESS, "index.js", true);
		const serde = withViewed(express, SERDE, "src/lib.rs", true);

		const log = withViewed(serde, EXPRESS, "lib/router.js", true);

		expect(log.map((entry) => entry.id)).toEqual([EXPRESS, SERDE]);
	});

	test("drops a comparison with nothing left viewed", () => {
		const marked = withViewed([], EXPRESS, "index.js", true);

		expect(withViewed(marked, EXPRESS, "index.js", false)).toEqual([]);
	});

	test("forgets the oldest comparisons past the limit", () => {
		let log = withViewed([], EXPRESS, "index.js", true);
		for (let index = 0; index < REVIEW_LIMIT; index++) {
			log = withViewed(log, `comparison ${index}`, "a.js", true);
		}

		expect(log).toHaveLength(REVIEW_LIMIT);
		expect(viewedIn(log, EXPRESS).size).toBe(0);
	});
});

describe("parseViewedLog", () => {
	test("reads back what was stored", () => {
		const log = withViewed([], EXPRESS, "index.js", true);

		expect(parseViewedLog(JSON.stringify(log))).toEqual(log);
	});

	test.each([
		["nothing stored", null],
		["an empty string", ""],
		["broken JSON", "{"],
		["an object", '{"id":"x"}'],
	])("reads %s as nothing viewed", (_, raw) => {
		expect(parseViewedLog(raw)).toEqual([]);
	});

	test("skips entries that are not reviews", () => {
		const raw = JSON.stringify([
			{ id: EXPRESS, paths: ["index.js"] },
			{ id: 3, paths: [] },
			{ id: SERDE, paths: [1] },
			"text",
		]);

		expect(parseViewedLog(raw)).toEqual([{ id: EXPRESS, paths: ["index.js"] }]);
	});
});
