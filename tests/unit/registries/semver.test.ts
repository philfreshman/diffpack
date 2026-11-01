import { describe, expect, test } from "bun:test";
import { compareVersionsDesc } from "#/lib/registries/semver.ts";

function newestFirst(versions: string[]): string[] {
	return [...versions].sort(compareVersionsDesc);
}

describe("compareVersionsDesc", () => {
	test("orders by major, minor and patch numerically", () => {
		expect(newestFirst(["1.9.0", "1.10.0", "2.0.0", "1.10.1"])).toEqual([
			"2.0.0",
			"1.10.1",
			"1.10.0",
			"1.9.0",
		]);
	});

	test("ranks a release above its own pre-releases", () => {
		expect(newestFirst(["1.2.0-rc.1", "1.2.0", "1.1.9"])).toEqual([
			"1.2.0",
			"1.2.0-rc.1",
			"1.1.9",
		]);
	});

	test("compares numeric pre-release identifiers as numbers", () => {
		expect(newestFirst(["1.0.0-beta.9", "1.0.0-beta.10"])).toEqual([
			"1.0.0-beta.10",
			"1.0.0-beta.9",
		]);
	});

	test("follows semver precedence between pre-release tags", () => {
		expect(
			newestFirst([
				"1.0.0-alpha",
				"1.0.0-beta",
				"1.0.0-alpha.1",
				"1.0.0-rc.1",
				"1.0.0-alpha.beta",
			]),
		).toEqual([
			"1.0.0-rc.1",
			"1.0.0-beta",
			"1.0.0-alpha.beta",
			"1.0.0-alpha.1",
			"1.0.0-alpha",
		]);
	});

	test("ignores a leading v and build metadata", () => {
		expect(newestFirst(["v2.0.0+incompatible", "v10.0.0", "v2.1.0"])).toEqual([
			"v10.0.0",
			"v2.1.0",
			"v2.0.0+incompatible",
		]);
	});
});
