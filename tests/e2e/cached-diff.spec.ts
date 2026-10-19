import { readFileSync } from "node:fs";
import { expect, type Page, type Route, test } from "@playwright/test";

const LEFT_PAD = "/npm/left-pad/1.1.0/1.1.3";

const ENGINE = { timeout: 90_000 };

const LOOKUP = /\/diffs\/v1\/[0-9a-f]{64}$/;

const NPM_TARBALL = /^https:\/\/registry\.npmjs\.org\/.+\/-\/.+\.tgz$/;

const CACHED_FILE = "served-from-the-cache.js";

const ENGINE_VERSION: string = JSON.parse(
	readFileSync(
		"node_modules/@philfreshman/diffpack-engine/package.json",
		"utf8",
	),
).version;

const cachedEntry = {
	schema: 1,
	engine: ENGINE_VERSION,
	registry: "npm",
	package: "left-pad",
	from: "1.1.0",
	to: "1.1.3",
	similarity_threshold: 0.75,
	ignore_whitespace: false,
	tree: {
		path: "",
		type: "directory",
		status: "modified",
		children: [
			{
				path: "index.js",
				type: "file",
				status: "modified",
				added: 1,
				removed: 1,
			},
			{
				path: CACHED_FILE,
				type: "file",
				status: "modified",
				added: 1,
				removed: 1,
			},
		],
	},
	patches: {
		[CACHED_FILE]: {
			data: `--- from/${CACHED_FILE}\n+++ to/${CACHED_FILE}\n- const answer = 41;\n+ const answer = 42;\n`,
			is_diff: true,
		},
	},
};

const ANY_ORIGIN = { "access-control-allow-origin": "*" };

const status = (page: Page) => page.getByTestId("diff-status");
const row = (page: Page, name: string) =>
	page.getByRole("treeitem").filter({ hasText: name });

async function recordArchiveDownloads(page: Page): Promise<string[]> {
	const downloaded: string[] = [];
	await page.route(NPM_TARBALL, (route) => {
		downloaded.push(route.request().url());
		return route.continue();
	});
	return downloaded;
}

async function answerLookups(
	page: Page,
	answer: (route: Route) => Promise<void>,
) {
	await page.route(LOOKUP, answer);
}

const hit = (route: Route) =>
	route.fulfill({ json: cachedEntry, headers: ANY_ORIGIN });

const miss = (route: Route) =>
	route.fulfill({ status: 404, body: "", headers: ANY_ORIGIN });

test("a cached diff renders without the worker downloading an archive", async ({
	page,
}) => {
	const archives = await recordArchiveDownloads(page);
	await answerLookups(page, hit);

	await page.goto(`${LEFT_PAD}/${CACHED_FILE}`);

	await expect(status(page)).toHaveAttribute("data-state", "ready");
	await expect(row(page, CACHED_FILE)).toBeVisible();
	await expect(page.getByTestId("diff-file")).toContainText(
		"const answer = 42;",
	);
	expect(archives).toEqual([]);
	expect(page.workers()).toEqual([]);
});

test("a miss falls through to building the diff here", async ({ page }) => {
	const archives = await recordArchiveDownloads(page);
	await answerLookups(page, miss);

	await page.goto(LEFT_PAD);

	await expect(status(page)).toHaveAttribute("data-state", "ready", ENGINE);
	await expect(row(page, "index.js")).toBeVisible();
	await expect(row(page, CACHED_FILE)).toHaveCount(0);
	expect(archives.length).toBeGreaterThan(0);
});

test("a cache that cannot be read does not break the diff", async ({
	page,
}) => {
	await answerLookups(page, (route) => route.abort("failed"));
	const errors: Error[] = [];
	page.on("pageerror", (error) => errors.push(error));

	await page.goto(LEFT_PAD);

	await expect(status(page)).toHaveAttribute("data-state", "ready", ENGINE);
	await expect(row(page, "index.js")).toBeVisible();
	expect(errors).toEqual([]);
});

test("a file the cached entry has no patch for is worked out here", async ({
	page,
}) => {
	const archives = await recordArchiveDownloads(page);
	await answerLookups(page, hit);

	await page.goto(`${LEFT_PAD}/index.js`);

	await expect(page.getByTestId("diff-file")).toContainText("leftPad", ENGINE);
	expect(archives.length).toBeGreaterThan(0);
});
