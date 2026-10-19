import { createFileRoute } from "@tanstack/react-router";
import { DiffWorkspace } from "#/components/workspace/DiffWorkspace/DiffWorkspace.tsx";
import { requireAdapter } from "#/lib/registries/index.ts";
import { documentHead } from "#/lib/url/documentMeta.ts";
import { parseSlug } from "#/lib/url/slug.ts";

export const Route = createFileRoute("/$registry/$")({
	loader: ({ params }) =>
		parseSlug(requireAdapter(params.registry), params._splat ?? ""),
	head: ({ params, loaderData }) =>
		loaderData ? documentHead(requireAdapter(params.registry), loaderData) : {},
	component: DiffRoute,
});

function DiffRoute() {
	return <DiffWorkspace slug={Route.useLoaderData()} />;
}
