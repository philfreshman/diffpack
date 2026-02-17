import { registries } from "./registries.ts";
import type { SearchResult } from "./types.ts";

export function getRegistry(): string {
	const headerContainer = document.getElementById("header-container");
	return headerContainer?.dataset.registry || "";
}

export async function searchPackages(query: string): Promise<SearchResult[]> {
	const registryName = getRegistry();
	const registry = registries[registryName];

	if (!registry) {
		throw new Error(`Unsupported registry for search: ${registryName}`);
	}

	return registry.search(query);
}

export async function fetchVersions(packageName: string): Promise<string[]> {
	const registryName = getRegistry();
	const registry = registries[registryName];

	if (!registry) {
		throw Error(`Registry not found: ${registryName}`);
	}

	return registry.getVersions(packageName);
}

export function buildDownloadUrl(packageName: string, version: string): string {
	const registryName = getRegistry();
	const registry = registries[registryName];

	if (!registry) {
		return "";
	}

	return registry.getDownloadUrl(packageName, version);
}
