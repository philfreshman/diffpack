import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

function isLanding(pathname: string): boolean {
	return pathname.split("/").filter(Boolean).length === 0;
}

export function getRouter() {
	return createTanStackRouter({
		routeTree,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		// Only landing <-> workspace is animated; see `::view-transition-*` in globals.css.
		defaultViewTransition: {
			types: ({ fromLocation, toLocation }) =>
				fromLocation &&
				isLanding(fromLocation.pathname) !== isLanding(toLocation.pathname)
					? ["page"]
					: false,
		},
	});
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
