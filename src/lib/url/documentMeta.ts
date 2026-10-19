import type { RegistryAdapter } from "#/lib/registries/types.ts";
import { SITE_NAME, siteUrl } from "./site.ts";
import { buildPath, type DiffSlug } from "./slug.ts";

export interface DocumentMeta {
	title: string;
	description: string;
}

function branded(subject: string): string {
	return `${subject} | ${SITE_NAME}`;
}

export function documentMeta(
	adapter: RegistryAdapter,
	slug: DiffSlug,
): DocumentMeta {
	if (!slug.package) {
		return {
			title: branded(`Compare ${adapter.label} package versions`),
			description: `Compare two versions of any ${adapter.label} package in your browser and see every file that changed.`,
		};
	}

	if (!slug.from || !slug.to) {
		return {
			title: branded(`Compare ${slug.package} versions`),
			description: `Compare two versions of ${slug.package} in your browser and see every file that changed.`,
		};
	}

	const comparison = `${slug.package} ${slug.from} → ${slug.to}`;

	return {
		title: branded(slug.file ? `${comparison} · ${slug.file}` : comparison),
		description: slug.file
			? `Changes to ${slug.file} in ${comparison}.`
			: `Changes in ${comparison}.`,
	};
}

export function canonicalUrl(adapter: RegistryAdapter, slug: DiffSlug): string {
	return siteUrl(buildPath(adapter, { ...slug, file: "" }));
}

export function documentHead(adapter: RegistryAdapter, slug: DiffSlug) {
	const { title, description } = documentMeta(adapter, slug);
	const url = canonicalUrl(adapter, slug);

	return {
		meta: [
			{ title },
			{ name: "description", content: description },
			{ property: "og:url", content: url },
			{ property: "og:title", content: title },
			{ property: "og:description", content: description },
			{ property: "twitter:url", content: url },
			{ property: "twitter:title", content: title },
			{ property: "twitter:description", content: description },
		],
		links: [{ rel: "canonical", href: url }],
	};
}
