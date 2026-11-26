import path from "node:path";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, lazyPlugins } from "vite-plus";

const RUNS_UNDER_VITEST = process.env.VITEST === "true";

export default defineConfig({
	fmt: {
		useTabs: true,
		printWidth: 80,
		singleQuote: false,
		trailingComma: "all",
		sortImports: { newlinesBetween: false },
		ignorePatterns: [
			"**/*.md",
			".claude/",
			".github/",
			"docs/",
			"fixtures/",
			"public/",
			"rule-packs/",
			".fallowrc.jsonc",
			".mcp.json",
			"renovate.json",
			"src/routeTree.gen.ts",
		],
	},
	lint: {
		plugins: ["typescript", "unicorn", "oxc", "react", "jsx-a11y"],
		categories: {
			correctness: "error",
		},
		env: {
			browser: true,
			builtin: true,
		},
		rules: {
			"jsx-a11y/control-has-associated-label": "off",
			"jsx-a11y/prefer-tag-over-role": "off",
			"react/button-has-type": "error",
			"react/no-array-index-key": "error",
			"react/no-danger": "error",
			"react/rules-of-hooks": "error",
			"unicorn/no-new-array": "off",
			"vite-plus/prefer-vite-plus-imports": "error",
		},
		ignorePatterns: ["src/routeTree.gen.ts"],
		options: {
			typeAware: true,
			typeCheck: true,
		},
		overrides: [
			{
				files: ["tests/**"],
				rules: { "typescript/await-thenable": "off" },
			},
		],
		jsPlugins: [
			{
				name: "vite-plus",
				specifier: "vite-plus/oxlint-plugin",
			},
		],
	},
	// Headers and redirects go in routeRules, not `vercel.json`: the build writes
	// its own `.vercel/output/config.json`, so `vercel.json` rules are never read.
	plugins: RUNS_UNDER_VITEST
		? []
		: lazyPlugins(() => [
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
						// back to the slow path.
						"/assets/**.wasm": {
							headers: { "content-type": "application/wasm" },
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
			]),
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
	test: {
		dir: "tests/unit",
		include: ["**/*.test.ts"],
		environment: "node",
	},
});
