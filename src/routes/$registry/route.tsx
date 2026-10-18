import { createFileRoute, notFound } from "@tanstack/react-router";
import { getAdapter } from "#/lib/registries/index.ts";
import type { RegistryId } from "#/lib/registries/types.ts";

export const Route = createFileRoute("/$registry")({
	params: {
		// The cast is safe: `beforeLoad` 404s an unknown registry before any read.
		parse: ({ registry }) => ({ registry: registry as RegistryId }),
		stringify: ({ registry }) => ({ registry }),
	},
	beforeLoad: ({ params }) => {
		// Not returned as context: context is serialized into the SSR payload, and
		// an adapter has methods.
		if (!getAdapter(params.registry)) throw notFound();
	},
});
