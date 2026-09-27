import { describe, expect, test } from "bun:test";
import { nextSelection, resolveTheme, themeColor } from "#/lib/theme.ts";

describe("resolveTheme", () => {
	test("uses the OS preference when the selection is system", () => {
		expect(resolveTheme("system", true)).toBe("dark");
		expect(resolveTheme("system", false)).toBe("light");
	});

	test("ignores the OS preference when a theme was chosen explicitly", () => {
		expect(resolveTheme("light", true)).toBe("light");
		expect(resolveTheme("dark", false)).toBe("dark");
	});
});

describe("nextSelection", () => {
	test("cycles light to dark to system and back", () => {
		expect(nextSelection("light")).toBe("dark");
		expect(nextSelection("dark")).toBe("system");
		expect(nextSelection("system")).toBe("light");
	});
});

describe("themeColor", () => {
	test("matches the page background so browser chrome blends in", () => {
		expect(themeColor("light")).toBe("#fafafa");
		expect(themeColor("dark")).toBe("#000000");
	});
});
