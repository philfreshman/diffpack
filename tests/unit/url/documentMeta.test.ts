import { describe, expect, test } from "bun:test";
import { composerAdapter } from "#/lib/registries/composer.ts";
import { cratesAdapter } from "#/lib/registries/crates.ts";
import { npmAdapter } from "#/lib/registries/npm.ts";
import {
	canonicalUrl,
	documentHead,
	documentMeta,
} from "#/lib/url/documentMeta.ts";
import type { DiffSlug } from "#/lib/url/slug.ts";

describe("documentMeta", () => {
	test("names the comparison being viewed", () => {
		expect(
			documentMeta(npmAdapter, {
				registry: "npm",
				package: "express",
				from: "4.18.2",
				to: "5.1.0",
				file: "",
			}),
		).toEqual({
			title: "express 4.18.2 → 5.1.0 | diffpack",
			description: "Changes in express 4.18.2 → 5.1.0.",
		});
	});

	test("names the registry when no package is chosen", () => {
		expect(
			documentMeta(cratesAdapter, {
				registry: "crates",
				package: "",
				from: "",
				to: "",
				file: "",
			}),
		).toEqual({
			title: "Compare crates.io package versions | diffpack",
			description:
				"Compare two versions of any crates.io package in your browser and see every file that changed.",
		});
	});

	test("names a package that has no versions chosen yet", () => {
		expect(
			documentMeta(npmAdapter, {
				registry: "npm",
				package: "express",
				from: "",
				to: "",
				file: "",
			}),
		).toEqual({
			title: "Compare express versions | diffpack",
			description:
				"Compare two versions of express in your browser and see every file that changed.",
		});
	});

	test("names the file being read", () => {
		expect(
			documentMeta(npmAdapter, {
				registry: "npm",
				package: "express",
				from: "4.18.2",
				to: "5.1.0",
				file: "lib/router/index.js",
			}).title,
		).toBe("express 4.18.2 → 5.1.0 · lib/router/index.js | diffpack");
	});
});

const EXPRESS_COMPARISON: DiffSlug = {
	registry: "npm",
	package: "express",
	from: "4.18.2",
	to: "5.1.0",
	file: "",
};

const EXPRESS_ROUTER_FILE: DiffSlug = {
	...EXPRESS_COMPARISON,
	file: "lib/router/index.js",
};

const CRATES_LANDING: DiffSlug = {
	registry: "crates",
	package: "",
	from: "",
	to: "",
	file: "",
};

function sharedTags(slug: DiffSlug): Record<string, string> {
	return Object.fromEntries(
		documentHead(npmAdapter, slug)
			.meta.filter((tag) => "property" in tag)
			.map((tag) => [tag.property, tag.content]),
	);
}

describe("documentHead", () => {
	test("gives a route the title and description tags to render", () => {
		expect(documentHead(npmAdapter, EXPRESS_COMPARISON).meta).toEqual(
			expect.arrayContaining([
				{ title: "express 4.18.2 → 5.1.0 | diffpack" },
				{
					name: "description",
					content: "Changes in express 4.18.2 → 5.1.0.",
				},
			]),
		);
	});

	test("a shared comparison previews as that comparison", () => {
		const shared = sharedTags(EXPRESS_ROUTER_FILE);

		expect(shared["og:title"]).toBe(
			"express 4.18.2 → 5.1.0 · lib/router/index.js | diffpack",
		);
		expect(shared["og:description"]).toBe(
			"Changes to lib/router/index.js in express 4.18.2 → 5.1.0.",
		);
		expect(shared["twitter:title"]).toBe(shared["og:title"]);
		expect(shared["twitter:description"]).toBe(shared["og:description"]);
	});

	test("shares the comparison, not the home page", () => {
		const tags = documentHead(npmAdapter, EXPRESS_COMPARISON).meta;

		expect(tags).toEqual(
			expect.arrayContaining([
				{
					property: "og:url",
					content: "https://diffpack.io/npm/express/4.18.2/5.1.0",
				},
				{
					property: "twitter:url",
					content: "https://diffpack.io/npm/express/4.18.2/5.1.0",
				},
			]),
		);
	});

	test("names the canonical address of the page", () => {
		expect(documentHead(cratesAdapter, CRATES_LANDING).links).toEqual([
			{ rel: "canonical", href: "https://diffpack.io/crates" },
		]);
	});
});

describe("canonicalUrl", () => {
	test("folds every file of a comparison into the comparison itself", () => {
		expect(
			canonicalUrl(npmAdapter, {
				registry: "npm",
				package: "@types/node",
				from: "26.6.0",
				to: "26.7.0",
				file: "index.d.ts",
			}),
		).toBe("https://diffpack.io/npm/@types/node/26.6.0/26.7.0");
	});

	test("spells a package the way the registry does", () => {
		expect(
			canonicalUrl(composerAdapter, {
				registry: "composer",
				package: "Monolog/Monolog",
				from: "3.0.0",
				to: "3.1.0",
				file: "",
			}),
		).toBe("https://diffpack.io/composer/monolog/monolog/3.0.0/3.1.0");
	});
});
