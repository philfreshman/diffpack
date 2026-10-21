import type { RegistryId } from "#/lib/registries/types.ts";
import type { OsvEcosystem } from "./types.ts";

const ECOSYSTEMS: Record<RegistryId, OsvEcosystem> = {
	npm: "npm",
	crates: "crates.io",
	go: "Go",
	pypi: "PyPI",
	composer: "Packagist",
};

export function osvEcosystemOf(registry: RegistryId): OsvEcosystem {
	return ECOSYSTEMS[registry];
}
