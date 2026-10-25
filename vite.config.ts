import path from "node:path";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
	// Headers and redirects go in routeRules, not `vercel.json`: the build writes
	// its own `.vercel/output/config.json`, so `vercel.json` rules are never read.
	plugins: [
		tanstackStart(),
		nitro({
			routeRules: {
				// Old links to the previous site's `/index.html`.
				"/index.html": { redirect: { to: "/", status: 301 } },
				// Nitro already caches `/assets/**`; fonts come from `public/`.
				"/fonts/**": {
					headers: {
						"cache-control": "public, max-age=31536000, immutable",
					},
				},
				// `instantiateStreaming` needs `application/wasm`, or it silently falls
				// back to the slow path. The cache header must be repeated: a matching
				// Vercel route ends matching, so `/assets/**` never applies here.
				"/assets/**.wasm": {
					headers: {
						"content-type": "application/wasm",
						"cache-control": "public, max-age=31536000, immutable",
					},
				},
				"/**": {
					headers: {
						"cache-control":
							"public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
					},
				},
			},
		}),
		viteReact({ compiler: true }),
	],
	resolve: {
		tsconfigPaths: true,
		// DIFFPACK_ENGINE_LOCAL=../diffpack-engine/pkg runs an unreleased engine build.
		...(process.env.DIFFPACK_ENGINE_LOCAL
			? {
					alias: {
						"@philfreshman/diffpack-engine": path.resolve(
							process.env.DIFFPACK_ENGINE_LOCAL,
						),
					},
				}
			: {}),
	},
	optimizeDeps: {
		// Pre-bundling breaks the wasm-pack glue's link to the fingerprinted `.wasm`
		// URL that `diff.worker.ts` initialises it with.
		exclude: ["@philfreshman/diffpack-engine"],
	},
	worker: {
		format: "es",
	},
});
