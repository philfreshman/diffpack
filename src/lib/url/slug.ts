import type { RegistryAdapter, RegistryId } from "#/lib/registries/types.ts";

export interface DiffSlug {
	registry: RegistryId;
	package: string;
	from: string;
	to: string;
	file: string;
}

// `decodeURIComponent` throws on a mis-encoded segment, such as a bare "%".
function decodeSegment(segment: string): string {
	try {
		return decodeURIComponent(segment);
	} catch {
		return segment;
	}
}

export function parseSlug(adapter: RegistryAdapter, splat: string): DiffSlug {
	const segments = splat.split("/").filter(Boolean).map(decodeSegment);
	const { name, rest } = adapter.packagePath.parse(segments);

	return {
		registry: adapter.id,
		package: name,
		from: rest[0] ?? "",
		to: rest[1] ?? "",
		file: rest.slice(2).join("/"),
	};
}

// Keeps "@" unescaped: `/npm/@types/node` is the live, indexed URL.
function encodeSegment(segment: string): string {
	return encodeURIComponent(segment).replaceAll("%40", "@");
}

/** The inverse of {@link parseSlug}. */
export function buildPath(
	adapter: RegistryAdapter,
	slug: Omit<Partial<DiffSlug>, "registry">,
): string {
	const name = adapter.packagePath.toSegments(slug.package ?? "");
	const from = slug.from ?? "";
	const to = slug.to ?? "";
	// Without both versions, a file segment would read back as a version.
	const file = from && to ? (slug.file ?? "") : "";

	const segments = [...name, from, to, ...file.split("/")]
		.filter(Boolean)
		.map(encodeSegment);

	return `/${[adapter.id, ...segments].join("/")}`;
}
