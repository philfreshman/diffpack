import { z } from "zod";
import { PROXY_ORIGIN } from "#/lib/proxy/origin.ts";
import { getJson, getText } from "./http.ts";
import type { Fetcher, RegistryAdapter, SearchResult } from "./types.ts";

const PROXY_URL = "https://proxy.golang.org";

const MAX_SEARCH_RESULTS = 10;
const PROXY_LONGEST_SEARCH_TEXT = 100;

const PackageSearchResponse = z.object({
	items: z
		.array(
			z.object({
				modulePath: z.string(),
				packagePath: z.string(),
				version: z.string(),
				synopsis: z.string().optional(),
			}),
		)
		.nullable(),
});

type FoundPackage = NonNullable<
	z.infer<typeof PackageSearchResponse>["items"]
>[number];

// Tells a path's "/v5" major-version suffix (no dots) apart from `v5.3.1`.
export const MODULE_VERSION = /^v\d+\.\d+\.\d+/;

// The proxy 404s unless uppercase is escaped: `Masterminds` → `!masterminds`.
function escapeModulePath(name: string): string {
	return name.replace(/[A-Z]/g, (char) => `!${char.toLowerCase()}`);
}

function parseVersion(version: string): { numbers: number[]; suffix: string } {
	// Build metadata ("+incompatible") plays no part in ordering.
	const [withoutBuild = ""] = version.replace(/^v/, "").split("+");
	const [core = "", ...suffix] = withoutBuild.split("-");

	return {
		numbers: core.split(".").map((part) => Number.parseInt(part, 10) || 0),
		suffix: suffix.join("-"),
	};
}

function compareVersionsDesc(a: string, b: string): number {
	const left = parseVersion(a);
	const right = parseVersion(b);

	for (let i = 0; i < 3; i++) {
		const diff = (right.numbers[i] ?? 0) - (left.numbers[i] ?? 0);
		if (diff !== 0) return diff;
	}

	// A release outranks any pre-release of the same version.
	if (left.suffix === right.suffix) return 0;
	if (!left.suffix) return -1;
	if (!right.suffix) return 1;
	return right.suffix.localeCompare(left.suffix);
}

function moduleDescription(packages: FoundPackage[]): string | undefined {
	const root = packages.find((item) => item.packagePath === item.modulePath);
	return (
		root?.synopsis ||
		packages.find((item) => item.synopsis)?.synopsis ||
		undefined
	);
}

function groupByModule(items: FoundPackage[]): Map<string, FoundPackage[]> {
	const packagesByModule = new Map<string, FoundPackage[]>();
	for (const item of items) {
		const packages = packagesByModule.get(item.modulePath) ?? [];
		packagesByModule.set(item.modulePath, [...packages, item]);
	}
	return packagesByModule;
}

function startsWithDomain(path: string): boolean {
	const [firstElement = ""] = path.split("/");
	return firstElement.includes(".");
}

function servedByModuleProxy(item: FoundPackage): boolean {
	return startsWithDomain(item.modulePath);
}

function modulesOf(items: FoundPackage[]): SearchResult[] {
	const packagesByModule = groupByModule(items.filter(servedByModuleProxy));
	return [...packagesByModule].map(([name, packages]) => ({
		name,
		version: packages[0]?.version,
		description: moduleDescription(packages),
	}));
}

function isAcceptedSearchText(query: string): boolean {
	return query.length > 0 && query.length <= PROXY_LONGEST_SEARCH_TEXT;
}

function looksLikeModulePath(query: string): boolean {
	return query.includes("/") && startsWithDomain(query);
}

export function createGoAdapter(
	fetcher: Fetcher = fetch,
	proxyOrigin = PROXY_ORIGIN,
): RegistryAdapter {
	async function listVersions(
		name: string,
		signal?: AbortSignal,
	): Promise<string[]> {
		const list = await getText(
			fetcher,
			`${PROXY_URL}/${escapeModulePath(name)}/@v/list`,
			signal,
			`go: no versions for ${name}`,
		);

		const versions = list
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean);

		// A module that was never tagged lists nothing at all — the proxy still
		// resolves a pseudo-version for its default branch.
		if (versions.length === 0) {
			const latest = await latestVersion(name, signal);
			return latest ? [latest] : [];
		}

		return versions.sort(compareVersionsDesc);
	}

	async function latestVersion(
		name: string,
		signal?: AbortSignal,
	): Promise<string | null> {
		const res = await fetcher(
			`${PROXY_URL}/${escapeModulePath(name)}/@latest`,
			{ signal },
		);
		if (!res.ok) return null;

		const data = (await res.json()) as { Version?: unknown };
		return typeof data.Version === "string" ? data.Version : null;
	}

	async function resolvedModule(
		name: string,
		signal?: AbortSignal,
	): Promise<SearchResult | undefined> {
		try {
			const versions = await listVersions(name, signal);
			if (versions.length === 0) return undefined;

			return {
				name,
				version: versions[0],
				description: `Go module — ${versions.length} version${versions.length === 1 ? "" : "s"}`,
			};
		} catch (error) {
			// A cancelled keystroke is not a miss — only the caller can tell those apart.
			if (signal?.aborted) throw error;
			// An unresolvable path may be a partial one, which keyword search can still find.
			return undefined;
		}
	}

	async function searchByKeyword(
		query: string,
		signal?: AbortSignal,
	): Promise<SearchResult[]> {
		if (!isAcceptedSearchText(query)) return [];

		const payload = await getJson(
			fetcher,
			`${proxyOrigin}/v1/go/search?q=${encodeURIComponent(query)}`,
			signal,
			`go: search for ${query} failed`,
			proxyOrigin,
		);

		return modulesOf(PackageSearchResponse.parse(payload).items ?? []).slice(
			0,
			MAX_SEARCH_RESULTS,
		);
	}

	return {
		id: "go",
		label: "Go",
		tagline: "Go modules & standard ecosystem",
		capabilities: { searchPlaceholder: "Search Go modules…" },
		packagePath: {
			parse(segments) {
				const versionIndex = segments.findIndex((segment) =>
					MODULE_VERSION.test(segment),
				);
				const nameEnd = versionIndex === -1 ? segments.length : versionIndex;

				return {
					name: segments.slice(0, nameEnd).join("/"),
					rest: segments.slice(nameEnd),
				};
			},

			toSegments(name) {
				return name.split("/").filter(Boolean);
			},
		},

		async search(query, signal) {
			const name = query
				.trim()
				.replace(/^https?:\/\//, "")
				.replace(/\/+$/, "");

			const module = looksLikeModulePath(name)
				? await resolvedModule(name, signal)
				: undefined;
			if (module) return [module];

			return searchByKeyword(name, signal);
		},

		async versions(name, signal) {
			return listVersions(name, signal);
		},

		downloadUrl(name, version) {
			return `${PROXY_URL}/${escapeModulePath(name)}/@v/${version}.zip`;
		},
	};
}

export const goAdapter = createGoAdapter();
