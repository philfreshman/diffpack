import { registryAdapters } from "#/lib/registries/index.ts";
import { siteUrl } from "./site.ts";
import { buildPath } from "./slug.ts";

function sitemapPaths(): string[] {
	return ["/", ...registryAdapters.map((adapter) => buildPath(adapter, {}))];
}

export function sitemapXml(): string {
	const entries = sitemapPaths().map(
		(path) => `  <url><loc>${siteUrl(path)}</loc></url>`,
	);

	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...entries,
		"</urlset>",
		"",
	].join("\n");
}
