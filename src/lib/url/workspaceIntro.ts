import type { RegistryAdapter } from "#/lib/registries/types.ts";
import type { DiffSlug } from "./slug.ts";

export function workspaceIntro(
	adapter: RegistryAdapter,
	slug: DiffSlug,
): string {
	if (slug.package && slug.from && slug.to) {
		return `Every file that changed between ${slug.package} ${slug.from} and ${slug.to}: added, removed, renamed or edited files, with a diff for each.`;
	}

	return `Compare two versions of any ${adapter.label} package. Search for a package, pick two versions, and see every file that was added, removed, renamed or changed.`;
}
