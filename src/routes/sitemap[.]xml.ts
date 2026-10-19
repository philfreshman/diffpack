import { createFileRoute } from "@tanstack/react-router";
import { sitemapXml } from "#/lib/url/sitemap.ts";

export const Route = createFileRoute("/sitemap.xml")({
	server: {
		handlers: {
			GET: () =>
				new Response(sitemapXml(), {
					headers: { "content-type": "application/xml; charset=utf-8" },
				}),
		},
	},
});
