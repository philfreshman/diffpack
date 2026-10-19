import { QueryClientProvider } from "@tanstack/react-query";
import {
	createRootRoute,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import { useState } from "react";
import { Analytics } from "#/components/Analytics.tsx";
import { NotFound } from "#/components/NotFound/NotFound.tsx";
import { GA_SCRIPT, GA_SRC } from "#/lib/analytics.ts";
import { createQueryClient } from "#/lib/query/queryClient.ts";
import { THEME_SCRIPT } from "#/lib/themeScript.ts";
import { TREE_WIDTH_SCRIPT } from "#/lib/tree/widthScript.ts";
import { buildDiffBootScript } from "#/lib/worker/bootScript.ts";
import diffWorkerUrl from "#/lib/worker/diff.worker.ts?worker&url";
import globalsCss from "#/styles/globals.css?url";

const DESCRIPTION =
	"Compare package versions across ecosystems. Clean. Fast. Source-aware dependency review tool for npm, crates.io, Go, PyPI and Packagist.";

const KEYWORDS =
	"dependency, review, diff, npm, crates.io, go, pypi, packagist, composer, python, rust, golang, php, javascript, typescript, package, compare";

const SITE = "https://diffpack.io";

const SHARE_IMAGE = "/web-app-manifest-512x512.png";

const DIFF_BOOT_SCRIPT = buildDiffBootScript(diffWorkerUrl);

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1.0" },
			{ title: "diffpack" },
			{ name: "description", content: DESCRIPTION },
			{ name: "keywords", content: KEYWORDS },
			{ property: "og:type", content: "website" },
			{ property: "og:url", content: SITE },
			{ property: "og:title", content: "diffpack" },
			{ property: "og:description", content: DESCRIPTION },
			{ property: "og:image", content: SHARE_IMAGE },
			{ property: "twitter:card", content: "summary_large_image" },
			{ property: "twitter:url", content: SITE },
			{ property: "twitter:title", content: "diffpack" },
			{ property: "twitter:description", content: DESCRIPTION },
			{ property: "twitter:image", content: SHARE_IMAGE },
			{ name: "apple-mobile-web-app-title", content: "diffpack" },
		],
		links: [
			{ rel: "stylesheet", href: globalsCss },
			{
				rel: "icon",
				type: "image/png",
				href: "/favicon-96x96.png",
				sizes: "96x96",
			},
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg",
				sizes: "any",
			},
			{ rel: "shortcut icon", href: "/favicon.ico" },
			{
				rel: "apple-touch-icon",
				sizes: "180x180",
				href: "/apple-touch-icon.png",
			},
			{ rel: "manifest", href: "/site.webmanifest" },
		],
	}),
	notFoundComponent: NotFound,
	shellComponent: RootDocument,
});

function RootDocument() {
	// Not a module singleton, which the server would share between requests.
	const [queryClient] = useState(createQueryClient);

	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: the engine is started before hydration, so this must be inline */}
				<script dangerouslySetInnerHTML={{ __html: DIFF_BOOT_SCRIPT }} />
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: pre-paint theme script must be inline */}
				<script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: pre-paint tree width script must be inline */}
				<script dangerouslySetInnerHTML={{ __html: TREE_WIDTH_SCRIPT }} />
				<script async src={GA_SRC} />
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: gtag.js bootstrap must be inline, ahead of the async library */}
				<script dangerouslySetInnerHTML={{ __html: GA_SCRIPT }} />
			</head>
			<body>
				<QueryClientProvider client={queryClient}>
					<Outlet />
					<Analytics />
				</QueryClientProvider>
				<Scripts />
			</body>
		</html>
	);
}
