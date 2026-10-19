export type RegistryId = "npm" | "crates" | "go" | "pypi" | "composer";

export interface SearchResult {
	name: string;
	version?: string;
	description?: string;
}

export interface PackagePath {
	/** Splits `<package…>/<from>/<to>/<file…>` into the name and everything after it. */
	parse(segments: string[]): { name: string; rest: string[] };
	toSegments(name: string): string[];
}

export type Fetcher = (
	input: string | URL | Request,
	init?: RequestInit,
) => Promise<Response>;

export interface RegistryCapabilities {
	discoverySearch: boolean;
	searchPlaceholder: string;
	searchHint?: string;
}

export interface VersionLinkCopy {
	labelPrefix: string;
	title: string;
	opens: "download" | "page";
}

export interface RegistryAdapter {
	id: RegistryId;
	label: string;
	tagline: string;
	capabilities: RegistryCapabilities;
	packagePath: PackagePath;
	versionLink?: VersionLinkCopy;
	search(query: string, signal?: AbortSignal): Promise<SearchResult[]>;
	/** Newest first. */
	versions(name: string, signal?: AbortSignal): Promise<string[]>;
	/** Only a link to show: the engine does its own downloads. */
	downloadUrl(name: string, version: string): string;
}
