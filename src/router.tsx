import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/** Whether a pathname is the landing page rather than a registry's workspace. */
function isLanding(pathname: string): boolean {
	return pathname.split("/").filter(Boolean).length === 0;
}

export function getRouter() {
	return createTanStackRouter({
		routeTree,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		// Arriving at the workspace from the landing page, and leaving it again,
		// runs through `document.startViewTransition()` (ignored where the browser
		// lacks it). Everything else is movement inside the workspace — another
		// registry, another package, another file — where crossfading the whole
		// document would be noise rather than continuity, so only the one
		// crossing is typed and animated. See `::view-transition-*` in
		// globals.css.
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
