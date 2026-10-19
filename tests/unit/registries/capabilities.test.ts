import { describe, expect, test } from "bun:test";
import { composerAdapter } from "#/lib/registries/composer.ts";
import { cratesAdapter } from "#/lib/registries/crates.ts";
import { goAdapter } from "#/lib/registries/go.ts";
import { npmAdapter } from "#/lib/registries/npm.ts";
import { pypiAdapter } from "#/lib/registries/pypi.ts";

describe("capabilities", () => {
	test("every registry invites a keyword search", () => {
		for (const adapter of [
			npmAdapter,
			cratesAdapter,
			pypiAdapter,
			goAdapter,
			composerAdapter,
		]) {
			expect(adapter.capabilities.searchPlaceholder).toContain("Search");
		}
	});
});
