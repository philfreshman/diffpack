import { cratesAdapter } from "./crates.ts";
import { goAdapter } from "./go.ts";
import { npmAdapter } from "./npm.ts";
import { pypiAdapter } from "./pypi.ts";
import type { RegistryAdapter, RegistryId } from "./types.ts";

/** Landing-page order. */
export const registryAdapters: RegistryAdapter[] = [
	npmAdapter,
	cratesAdapter,
	goAdapter,
	pypiAdapter,
];

const byId = new Map<string, RegistryAdapter>(
	registryAdapters.map((adapter) => [adapter.id, adapter]),
);

export function isRegistryId(segment: string): segment is RegistryId {
	return byId.has(segment);
}

export function getAdapter(segment: string): RegistryAdapter | undefined {
	return byId.get(segment);
}

// The `$registry` route already 404s an unknown id, so a miss here is a bug.
export function requireAdapter(segment: string): RegistryAdapter {
	const adapter = byId.get(segment);
	if (!adapter) throw new Error(`unknown registry: ${segment}`);

	return adapter;
}
