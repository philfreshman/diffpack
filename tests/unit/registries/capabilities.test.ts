import { describe, expect, test } from "bun:test";
import { composerAdapter } from "#/lib/registries/composer.ts";
import { cratesAdapter } from "#/lib/registries/crates.ts";
import { goAdapter } from "#/lib/registries/go.ts";
import { npmAdapter } from "#/lib/registries/npm.ts";
import { pypiAdapter } from "#/lib/registries/pypi.ts";

describe("capabilities", () => {
	test("every registry has keyword search and needs no hint", () => {
		for (const adapter of [
			npmAdapter,
			cratesAdapter,
			pypiAdapter,
			goAdapter,
			composerAdapter,
		]) {
			expect(adapter.capabilities.discoverySearch).toBe(true);
			expect(adapter.capabilities.searchHint).toBeUndefined();
			expect(adapter.capabilities.searchPlaceholder).toContain("Search");
		}
	});
});
