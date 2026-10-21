import { describe, expect, test } from "bun:test";
import { osvEcosystemOf } from "#/lib/vulnerabilities/ecosystem.ts";

describe("osvEcosystemOf", () => {
	test("names each registry the way OSV.dev spells its ecosystem", () => {
		expect(osvEcosystemOf("npm")).toBe("npm");
		expect(osvEcosystemOf("crates")).toBe("crates.io");
		expect(osvEcosystemOf("go")).toBe("Go");
		expect(osvEcosystemOf("pypi")).toBe("PyPI");
		expect(osvEcosystemOf("composer")).toBe("Packagist");
	});
});
