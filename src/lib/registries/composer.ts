import { z } from "zod";
import { PROXY_ORIGIN } from "#/lib/proxy/origin.ts";
import { getJson } from "./http.ts";
import type { Fetcher, RegistryAdapter } from "./types.ts";

const PACKAGIST_URL = "https://packagist.org";
const NAME_WIDTH = 2;
const PACKAGE_NAME =
	/^[a-z0-9]([_.-]?[a-z0-9]+)*\/[a-z0-9](([_.]|-{1,2})?[a-z0-9]+)*$/;

const SearchResponse = z.object({
	results: z.array(
		z.object({ name: z.string(), description: z.string().optional() }),
	),
});

const P2Response = z.object({
	packages: z.record(z.string(), z.array(z.object({ version: z.string() }))),
});

function encodedName(name: string): string {
	return name.split("/").map(encodeURIComponent).join("/");
}

export function createComposerAdapter(
	fetcher: Fetcher = fetch,
	proxyOrigin = PROXY_ORIGIN,
): RegistryAdapter {
	return {
		id: "composer",
		label: "Packagist",
		tagline: "PHP packages",
		capabilities: {
			discoverySearch: true,
			searchPlaceholder: "Search Packagist…",
		},
		versionLink: { action: "Packagist page for", title: "Open on Packagist" },
		packagePath: {
			parse(segments) {
				return {
					name: segments.slice(0, NAME_WIDTH).join("/").toLowerCase(),
					rest: segments.slice(NAME_WIDTH),
				};
			},

			toSegments(name) {
				return name.toLowerCase().split("/").filter(Boolean);
			},
		},

		async search(query, signal) {
			const payload = await getJson(
				fetcher,
				`${PACKAGIST_URL}/search.json?q=${encodeURIComponent(query)}&per_page=10`,
				signal,
				`composer: search for ${query} failed`,
			);

			return SearchResponse.parse(payload).results;
		},

		async versions(name, signal) {
			if (!PACKAGE_NAME.test(name)) {
				throw new Error(`composer: ${name} is not a vendor/package name`);
			}

			const payload = await getJson(
				fetcher,
				`${proxyOrigin}/v1/composer/p2/${encodedName(name)}.json`,
				signal,
				`composer: no versions for ${name}`,
			);

			const releases = P2Response.parse(payload).packages[name] ?? [];
			return releases.map((release) => release.version);
		},

		downloadUrl(name, version) {
			return `${PACKAGIST_URL}/packages/${encodedName(name)}#${encodeURIComponent(version)}`;
		},
	};
}

export const composerAdapter = createComposerAdapter();
