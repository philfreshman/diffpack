// Shared search service for fetching package data

import { parseGitHubRepoSlug, toGitHubRepoSlug } from "../utils/github.ts";
import type { SearchResult } from "./types.ts";

export function getRegistry(): string {
	const headerContainer = document.getElementById("header-container");
	return headerContainer?.dataset.registry || "npm";
}

type ZigPackage = {
	author: string;
	name: string;
	description?: string;
	tags?: string[];
	git?: string;
	links?: {
		github?: string | null;
	};
};

let zigPackagesCache: ZigPackage[] | null = null;
let zigPackagesPromise: Promise<ZigPackage[]> | null = null;

async function getZigPackages(): Promise<ZigPackage[]> {
	if (zigPackagesCache) return zigPackagesCache;
	if (!zigPackagesPromise) {
		zigPackagesPromise = fetch("https://zig.pm/api/packages")
			.then((res) => {
				if (!res.ok) {
					throw new Error("Failed to fetch Zig packages");
				}
				return res.json() as Promise<ZigPackage[]>;
			})
			.then((data) => {
				zigPackagesCache = data;
				return data;
			})
			.catch((error) => {
				zigPackagesPromise = null;
				throw error;
			});
	}
	return zigPackagesPromise;
}

function getZigRepoSlug(pkg: ZigPackage): string | null {
	const gitUrl = pkg.git || pkg.links?.github || "";
	return toGitHubRepoSlug(gitUrl);
}

export async function searchPackages(query: string): Promise<SearchResult[]> {
	const registry = getRegistry();

	if (registry === "zig") {
		const packages = await getZigPackages();
		const q = query.trim().toLowerCase();

		const results: SearchResult[] = [];
		for (const pkg of packages) {
			const repoSlug = getZigRepoSlug(pkg);
			if (!repoSlug) continue;

			const tags = pkg.tags?.join(" ") || "";
			const haystack = [pkg.name, pkg.author, pkg.description, repoSlug, tags]
				.filter(Boolean)
				.join(" ")
				.toLowerCase();

			if (q && !haystack.includes(q)) continue;

			const descriptor =
				pkg.author && pkg.name ? `zig.pm: ${pkg.author}/${pkg.name}` : "";
			const description = [descriptor, pkg.description]
				.filter(Boolean)
				.join(" • ");

			results.push({
				name: pkg.name,
				description: description || undefined,
				version: "latest",
			});

			if (results.length >= 10) break;
		}

		return results;
	}

	const url =
		registry === "npm"
			? `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=10`
			: `https://crates.io/api/v1/crates?q=${encodeURIComponent(query)}&per_page=10`;

	const res = await fetch(url);
	const data = await res.json();

	if (registry === "npm") {
		interface NpmSearchObject {
			package: {
				name: string;
				description: string;
				version: string;
			};
		}
		return data.objects.map((o: NpmSearchObject) => ({
			name: o.package.name,
			description: o.package.description,
			version: o.package.version,
		}));
	}

	interface CrateSearchObject {
		name: string;
		description: string;
		max_version: string;
	}
	return data.crates.map((c: CrateSearchObject) => ({
		name: c.name,
		description: c.description,
		version: c.max_version,
	}));
}

export async function fetchVersions(packageName: string): Promise<string[]> {
	const registry = getRegistry();

	if (registry === "zig") {
		const repo = parseGitHubRepoSlug(packageName);
		if (!repo) throw new Error("Invalid Zig package name");

		const tagsRes = await fetch(
			`https://api.github.com/repos/${repo.owner}/${repo.repo}/tags?per_page=100`,
		);
		if (!tagsRes.ok) throw new Error("Failed to fetch Zig versions");
		const tags = (await tagsRes.json()) as Array<{ name: string }>;
		const tagNames = tags.map((tag) => tag.name).filter(Boolean);
		if (tagNames.length > 0) return tagNames;

		const repoRes = await fetch(
			`https://api.github.com/repos/${repo.owner}/${repo.repo}`,
		);
		if (!repoRes.ok) return ["main"];
		const repoData = (await repoRes.json()) as { default_branch?: string };
		return [repoData.default_branch || "main"];
	}

	const url =
		registry === "npm"
			? `https://registry.npmjs.org/${encodeURIComponent(packageName)}`
			: `https://crates.io/api/v1/crates/${encodeURIComponent(packageName)}`;

	const res = await fetch(url);
	if (!res.ok) throw new Error("Failed to fetch versions");
	const data = await res.json();

	if (registry === "npm") {
		return Object.keys(data.versions).reverse();
	}

	interface CrateVersion {
		num: string;
	}
	return data.versions.map((v: CrateVersion) => v.num);
}
