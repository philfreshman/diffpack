import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/**
 * The page a pathname belongs to: the landing page, or one registry's
 * workspace. Everything after the registry segment — package, versions, the
 * open file — is state inside that page, not a different one.
 */
function pageOf(pathname: string): string {
	return pathname.split("/").filter(Boolean)[0] ?? "";
}

export function getRouter() {
	return createTanStackRouter({
		routeTree,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		// Navigating between pages runs through `document.startViewTransition()`
		// (ignored where the browser lacks it). Picking a file or a version keeps
		// the path changing under the same page, and crossfading the whole
		// document on every click in the tree would be noise, so only a change of
		// page is typed and animated — see `::view-transition-*` in globals.css.
		defaultViewTransition: {
			types: ({ fromLocation, toLocation }) =>
				fromLocation &&
				pageOf(fromLocation.pathname) !== pageOf(toLocation.pathname)
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
