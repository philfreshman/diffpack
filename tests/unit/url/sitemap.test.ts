import { describe, expect, test } from "bun:test";
import { sitemapXml } from "#/lib/url/sitemap.ts";

describe("sitemapXml", () => {
	test("lists the home page and every registry", () => {
		const locations = [...sitemapXml().matchAll(/<loc>(.*?)<\/loc>/g)].map(
			(match) => match[1],
		);

		expect(locations).toEqual([
			"https://diffpack.io/",
			"https://diffpack.io/npm",
			"https://diffpack.io/crates",
			"https://diffpack.io/go",
			"https://diffpack.io/pypi",
			"https://diffpack.io/composer",
		]);
	});

	test("is a sitemaps.org url set", () => {
		const xml = sitemapXml();

		expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
		expect(xml).toContain(
			'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		);
	});
});
