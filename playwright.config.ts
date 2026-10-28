import { defineConfig } from "@playwright/test";

// Configurable so several worktrees can each run their own server.
const port = Number(process.env.PORT ?? 4321);
const baseURL = process.env.BASE_URL ?? `http://localhost:${port}`;

const ALWAYS_MISSING_CACHE = "http://127.0.0.1:9";

export default defineConfig({
	testDir: "./tests/e2e",
	// Real registry downloads: slow and network-dependent.
	timeout: 120_000,
	expect: { timeout: 10_000 },
	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI
		? [["github"], ["html", { open: "never" }]]
		: [["list"]],
	use: { baseURL, trace: "retain-on-failure" },
	webServer: process.env.BASE_URL
		? undefined
		: {
				// Always a fresh production build: dev-only runs have let defects through.
				// `--strictPort`, or preview moves to another port while Playwright keeps
				// polling this one and tests another worktree's server.
				command: `bun run build && bunx vite preview --port ${port} --strictPort`,
				env: { VITE_DIFFPACK_CACHE_ORIGIN: ALWAYS_MISSING_CACHE },
				url: baseURL,
				reuseExistingServer: false,
				timeout: 600_000,
			},
});
