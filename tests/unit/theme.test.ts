import { describe, expect, test } from "bun:test";
import {
	applyTheme,
	nextSelection,
	readAppliedTheme,
	resolveTheme,
	themeColor,
} from "#/lib/theme.ts";

interface FakeElement {
	attributes: Map<string, string>;
	setAttribute(name: string, value: string): void;
	getAttribute(name: string): string | null;
}

function fakeElement(): FakeElement {
	const attributes = new Map<string, string>();

	return {
		attributes,
		setAttribute: (name, value) => attributes.set(name, value),
		getAttribute: (name) => attributes.get(name) ?? null,
	};
}

function fakeDocument({ prefersDark }: { prefersDark: boolean }) {
	const documentElement = fakeElement();
	const headChildren: FakeElement[] = [];
	const head = {
		querySelector: () =>
			headChildren.find(
				(child) => child.getAttribute("name") === "theme-color",
			) ?? null,
		appendChild: (child: FakeElement) => headChildren.push(child),
	};
	const defaultView = { matchMedia: () => ({ matches: prefersDark }) };
	const doc = {
		documentElement,
		head,
		defaultView,
		createElement: fakeElement,
	} as unknown as Document;

	return { doc, documentElement, headChildren };
}

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

describe("applyTheme", () => {
	test("marks the page with the resolved theme and the selection behind it", () => {
		const { doc, documentElement } = fakeDocument({ prefersDark: false });

		applyTheme(doc, "system");

		expect(documentElement.getAttribute("data-theme")).toBe("light");
		expect(documentElement.getAttribute("data-theme-selection")).toBe("system");
	});

	test("colours the browser chrome through one theme-color meta, reused on every change", () => {
		const { doc, headChildren } = fakeDocument({ prefersDark: true });

		applyTheme(doc, "light");
		applyTheme(doc, "system");

		expect(headChildren).toHaveLength(1);
		expect(headChildren[0]?.getAttribute("content")).toBe(themeColor("dark"));
	});
});

describe("readAppliedTheme", () => {
	test("reads back what applyTheme resolved", () => {
		const { doc } = fakeDocument({ prefersDark: false });

		applyTheme(doc, "system");

		expect(readAppliedTheme(doc)).toBe("light");
	});

	test("is dark when nothing has been applied, as the page is before its script runs", () => {
		expect(readAppliedTheme(fakeDocument({ prefersDark: false }).doc)).toBe(
			"dark",
		);
	});
});
