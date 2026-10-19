import { expect, type Page, test } from "@playwright/test";

// A two-file package, which keeps the downloads small.
const NODE = "/npm/node/26.6.0/26.7.0";

const ENGINE = { timeout: 90_000 };

const status = (page: Page) => page.getByTestId("diff-status");
const files = (page: Page) =>
	page.getByRole("treeitem").and(page.locator("[data-type='file']"));

async function ready(page: Page) {
	await expect(status(page)).toHaveAttribute("data-state", "ready", ENGINE);
}

test("a deep link is the request for a comparison", async ({ page }) => {
	await page.goto(NODE);
	await ready(page);

	await expect(files(page).filter({ hasText: "package.json" })).toHaveCount(1);
});

test("the comparison summary gives way to the finished tree", async ({
	page,
}) => {
	await page.goto(NODE);
	await ready(page);

	await expect(page.getByTestId("workspace-intro")).toHaveCount(0);
});

test("opening a file writes the URL and renders its diff", async ({ page }) => {
	await page.goto(NODE);
	await ready(page);

	await files(page).filter({ hasText: "package.json" }).click();

	await expect(page).toHaveURL(`${NODE}/package.json`);
	const view = page.getByTestId("diff-view");
	await expect(
		view.locator('tr[data-type="removed"]').filter({ hasText: "26.6.0" }),
	).toHaveCount(1);
	await expect(
		view.locator('tr[data-type="added"]').filter({ hasText: "26.7.0" }),
	).toHaveCount(1);
});

test("a deep link to a file opens it without a click", async ({ page }) => {
	await page.goto(`${NODE}/package.json`);
	await ready(page);

	await expect(page.getByTestId("diff-view")).toHaveAttribute(
		"data-path",
		"package.json",
	);
	await expect(page.getByTestId("diff-view")).toContainText("26.7.0");
});

test("the file on screen is the file last asked for", async ({ page }) => {
	await page.goto(NODE);
	await ready(page);

	// By path, not by row text: a row also carries its `+n`/`-n` counts.
	const [first, second] = await files(page).evaluateAll((rows) =>
		rows.map((row) => row.getAttribute("data-path") ?? ""),
	);
	expect(second).toBeDefined();

	// The second file on its own, so a stale reply with the first file's lines is a different answer, not just a different label.
	await page.goto(`${NODE}/${second}`);
	const alone = await page.getByTestId("diff-view").getAttribute("data-rows");

	await page.goto(NODE);
	await ready(page);
	// Back to back: the first reply must not overwrite the second, whichever arrives last.
	await files(page).nth(0).click();
	await files(page).nth(1).click();

	const view = page.getByTestId("diff-view");
	await expect(view).toHaveAttribute("data-path", String(second));
	await expect(view).toHaveAttribute("data-rows", alone ?? "");
	expect(first).not.toBe(second);
});

test("says so when the comparison cannot be built", async ({ page }) => {
	await page.goto("/npm/diffpack-package-that-does-not-exist/1.0.0/1.0.1");

	await expect(status(page)).toHaveAttribute("data-state", "error", ENGINE);
	await expect(page.getByTestId("progress-from")).toHaveAttribute(
		"data-state",
		"failed",
	);
	await expect(page.getByTestId("progress-to")).toHaveAttribute(
		"data-state",
		"failed",
	);
	await expect(page.getByTestId("progress-diff")).toHaveAttribute(
		"data-state",
		"waiting",
	);
	await expect(page.getByTestId("diff-error")).toHaveCount(2);
});

test("marks only the version that cannot be downloaded", async ({ page }) => {
	await page.goto("/npm/node/26.6.0/99.0.0");

	await expect(status(page)).toHaveAttribute("data-state", "error", ENGINE);
	await expect(page.getByTestId("progress-from")).toHaveAttribute(
		"data-state",
		"done",
	);
	await expect(page.getByTestId("progress-to")).toHaveAttribute(
		"data-state",
		"failed",
	);
	await expect(page.getByTestId("diff-error")).toContainText("99.0.0");
});

test("the progress box gives way to the comparison once it is built", async ({
	page,
}) => {
	await page.goto(NODE);

	await expect(page.getByTestId("diff-progress")).toBeVisible();
	await ready(page);
	await expect(page.getByTestId("diff-progress")).toHaveCount(0);
	await expect(page.getByTestId("diff-file")).toBeVisible();
});

test("a file the comparison does not contain is an error, not a spinner", async ({
	page,
}) => {
	await page.goto(`${NODE}/does/not/exist.js`);
	await ready(page);

	await expect(page.getByTestId("file-error")).toContainText(
		"does/not/exist.js",
	);
});

test("nothing to compare, nothing started", async ({ page }) => {
	await page.goto("/npm/express");

	await expect(status(page)).toHaveAttribute("data-state", "idle");
	await expect(page.getByRole("treeitem")).toHaveCount(0);
	await expect(status(page)).toBeEmpty();
});

test("extracts a Go module and strips its versioned root", async ({ page }) => {
	await page.goto("/go/github.com/go-chi/chi/v5/v5.3.1/v5.3.2");
	await ready(page);

	// Module zips prefix every entry with `<module>@<version>/`, which would make every file read as replaced.
	await expect(files(page).filter({ hasText: "tree.go" })).toHaveCount(1);
	await expect(page.locator("[data-path*='@v5.']")).toHaveCount(0);
});
