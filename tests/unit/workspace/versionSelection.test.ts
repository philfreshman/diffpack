import { describe, expect, test } from "bun:test";
import { resolveSelection } from "#/components/workspace/versionSelection.ts";

// Newest first, as every adapter promises.
const VERSIONS = ["3.0.0", "2.1.0", "2.0.0", "1.0.0"];

describe("resolveSelection", () => {
	test("defaults to the previous release against the newest", () => {
		expect(resolveSelection(VERSIONS, {})).toEqual({
			from: "2.1.0",
			to: "3.0.0",
		});
	});

	test("keeps what the URL asked for", () => {
		expect(resolveSelection(VERSIONS, { from: "1.0.0", to: "2.0.0" })).toEqual({
			from: "1.0.0",
			to: "2.0.0",
		});
	});

	test("defaults the half of the pair the URL leaves out", () => {
		expect(resolveSelection(VERSIONS, { from: "1.0.0" })).toEqual({
			from: "1.0.0",
			to: "3.0.0",
		});
	});

	test("drops a version the registry has never heard of", () => {
		expect(resolveSelection(VERSIONS, { from: "9.9.9", to: "2.0.0" })).toEqual({
			from: "2.1.0",
			to: "2.0.0",
		});
	});

	test("drops it from either half of the pair", () => {
		expect(resolveSelection(VERSIONS, { from: "1.0.0", to: "9.9.9" })).toEqual({
			from: "1.0.0",
			to: "3.0.0",
		});
	});

	test("compares a lone version against itself", () => {
		expect(resolveSelection(["1.0.0"], {})).toEqual({
			from: "1.0.0",
			to: "1.0.0",
		});
	});

	test("says what the URL says while the list is still on its way", () => {
		expect(resolveSelection([], { from: "1.0.0", to: "2.0.0" })).toEqual({
			from: "1.0.0",
			to: "2.0.0",
		});
		expect(resolveSelection([], {})).toEqual({ from: "", to: "" });
	});
});
