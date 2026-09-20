import path from "node:path";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
	// Nitro turns the Start server build into a deployable server: on Vercel it
	// is what produces `.vercel/output` and the function the site is served
	// from. Without it `vite build` emits a bare `dist/server/server.js` that
	// the host has no idea what to do with.
	//
	// The cache headers live here rather than in `vercel.json` because a build
	// that writes `.vercel/output/config.json` brings its own routing table —
	// `headers` left in `vercel.json` would be a file nobody reads. These end
	// up in that generated config, which is checkable without deploying.
	plugins: [
		tanstackStart(),
		nitro({
			routeRules: {
				// The Astro site served `/index.html`; anything still linking to it
				// should land on the home page rather than the catch-all route's
				// 404.
				"/index.html": { redirect: { to: "/", status: 301 } },
				// Hashed filenames, immutable by construction. `/assets/**` — which
				// is where the hashed `.wasm` lands too — nitro covers itself; the
				// fonts are copied from `public/` and need saying.
				"/fonts/**": {
					headers: {
						"cache-control": "public, max-age=31536000, immutable",
					},
				},
				// `WebAssembly.instantiateStreaming` refuses anything that is not
				// `application/wasm` and falls back to the slower, buffer-the-whole-
				// module path — on every cold comparison, with only a console warning
				// to say so. Static hosts vary on whether they get this right, so it
				// is stated rather than assumed.
				//
				// The cache header is repeated here rather than left to the
				// `/assets/**` rule below: these become Vercel routes, and a route
				// that matches without a `dest` ends the matching rather than falling
				// through to the next. Naming the wasm at all therefore takes it out
				// of the immutable rule — which is how it came to be served
				// `max-age=0, must-revalidate` and revalidated on every page load,
				// while every other hashed asset was cached for a year.
				"/assets/**.wasm": {
					headers: {
						"content-type": "application/wasm",
						"cache-control": "public, max-age=31536000, immutable",
					},
				},
				// Everything else is server-rendered HTML: never trusted by the
				// browser, held briefly at the edge, and served stale while it is
				// revalidated. Same policy the Astro site was deployed under.
				"/**": {
					headers: {
						"cache-control":
							"public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
					},
				},
			},
		}),
		viteReact(),
	],
	resolve: {
		tsconfigPaths: true,
		// Iterating on the engine without publishing a version. Point
		// `DIFFPACK_ENGINE_LOCAL` at a `wasm-pack` output directory — in a checkout of
		// philfreshman/diffpack-engine, that is its `pkg/` — and the build reads
		// that instead of the installed package:
		//
		//   DIFFPACK_ENGINE_LOCAL=../diffpack-engine/pkg bun run dev
		//
		// Unset, which is every CI run and every deploy, this is absent entirely
		// and the dependency resolves normally.
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
		// The engine is a `wasm-pack --target web` module: its JS glue expects to
		// be initialised against a `.wasm` URL the bundler has fingerprinted, and
		// Vite's dependency pre-bundler rewrites that relationship. Excluded, it
		// is served as authored — which is what `init({ module_or_path: wasmUrl })`
		// in `src/lib/worker/diff.worker.ts` is written against.
		exclude: ["@philfreshman/diffpack-engine"],
	},
	worker: {
		format: "es",
	},
});
