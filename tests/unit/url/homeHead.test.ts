import { describe, expect, test } from "bun:test";
import { homeHead } from "#/lib/url/homeHead.ts";

describe("homeHead", () => {
	test("names every registry in the title", () => {
		expect(homeHead().meta).toContainEqual({
			title:
				"diffpack: compare npm, crates.io, Go, PyPI and Packagist versions",
		});
	});

	test("tells search engines the site is called diffpack", () => {
		expect(homeHead().meta).toContainEqual({
			"script:ld+json": {
				"@context": "https://schema.org",
				"@type": "WebSite",
				name: "diffpack",
				alternateName: "diffpack.io",
				url: "https://diffpack.io/",
			},
		});
	});

	test("names the home page as its own canonical address", () => {
		expect(homeHead().links).toEqual([
			{ rel: "canonical", href: "https://diffpack.io/" },
		]);
		expect(homeHead().meta).toContainEqual({
			property: "og:url",
			content: "https://diffpack.io/",
		});
	});
});
