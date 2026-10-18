import { expect, type Page, test } from "@playwright/test";
import { SPLIT_VIEW } from "#/lib/storage/settings.ts";

const MANIFEST = "/npm/express/4.18.2/5.1.0/package.json";

const ENGINE = { timeout: 90_000 };

async function open(page: Page, path: string) {
	await page.goto(path);
	await expect(page.getByTestId("diff-view")).toBeVisible(ENGINE);
}

const lines = (page: Page, type: string) =>
	page.getByTestId("diff-view").locator(`tr[data-type="${type}"]`);

test("shows the file as numbered lines, marked by what happened to them", async ({
	page,
}) => {
	await open(page, MANIFEST);

	const added = lines(page, "added").first();
	await expect(added).toBeVisible();
	await expect(added.getByTestId("old-number")).toHaveText("");
	await expect(added.getByTestId("new-number")).toHaveText(/^\d+$/);

	const removed = lines(page, "removed").first();
	await expect(removed.getByTestId("old-number")).toHaveText(/^\d+$/);
	await expect(removed.getByTestId("new-number")).toHaveText("");
});

// A handful of changes in a 17 000-line file: what folding and virtualisation are for.
const LODASH = "/npm/lodash/4.17.20/4.17.21/lodash.js";

const folds = (page: Page) => page.getByTestId("fold");

test("stands the untouched lines down into folds", async ({ page }) => {
	await open(page, LODASH);

	await expect(folds(page).first()).toHaveText(/Collapsed \d+ lines/);
});

test("opens a fold twenty lines at a time", async ({ page }) => {
	await open(page, LODASH);

	// Only a fold in the body steps inward; the first and last open whole.
	const stepped = folds(page)
		.filter({ has: page.getByRole("button", { name: /lines down$/ }) })
		.first();
	const start = Number(await stepped.getAttribute("data-start"));
	const count = Number(await stepped.getAttribute("data-count"));
	await stepped.getByRole("button", { name: "Expand 20 lines down" }).click();
	// The rest of the fold is now below the window, and only rows near it are drawn.
	await page.getByTestId("diff-scroller").evaluate((node) => {
		node.scrollTop += 20 * 24;
	});

	const left = folds(page).and(page.locator(`[data-start="${start + 20}"]`));
	await expect(left).toHaveAttribute("data-count", String(count - 20));
});

test("opens a fold whole", async ({ page }) => {
	await open(page, LODASH);

	const fold = folds(page).first();
	const start = await fold.getAttribute("data-start");
	await fold.getByRole("button", { name: "Expand all lines" }).click();

	await expect(
		folds(page).and(page.locator(`[data-start="${start}"]`)),
	).toHaveCount(0);
});

test("draws only the rows on screen, however long the file", async ({
	page,
}) => {
	await open(page, LODASH);

	const scroller = page.getByTestId("diff-scroller");
	const drawn = page.getByTestId("diff-view").locator("tr");
	const overflow = await scroller.evaluate(
		(node) => node.scrollHeight / node.clientHeight,
	);
	expect(overflow).toBeGreaterThan(3);

	const screenful = await drawn.count();
	expect(screenful).toBeLessThan(200);

	const top = await drawn.first().getAttribute("data-index");
	await scroller.evaluate((node) => {
		node.scrollTop = node.scrollHeight;
	});

	await expect(drawn.first()).not.toHaveAttribute("data-index", top ?? "");
	expect(await drawn.count()).toBeLessThan(200);
});

// Virtualisation swaps the element under a still pointer; any `auto` cursor would flicker.
test("keeps a text cursor over the whole file while it is scrolled", async ({
	page,
}) => {
	await open(page, LODASH);

	const scroller = page.getByTestId("diff-scroller");
	const cursors = await scroller.evaluate((node) => {
		const seen = new Set<string>();
		for (const element of [node, ...node.querySelectorAll("*")]) {
			if (element.closest("button")) continue;
			seen.add(getComputedStyle(element).cursor);
		}
		return [...seen];
	});

	expect(cursors).toEqual(["text"]);
});

test("puts the old file beside the new one when that is the preference", async ({
	page,
}) => {
	await page.addInitScript(
		(key) => localStorage.setItem(key, "true"),
		SPLIT_VIEW.key,
	);
	await open(page, MANIFEST);

	const replaced = page
		.getByTestId("diff-view")
		.locator('tr[data-left-type="removed"][data-right-type="added"]');
	await expect(replaced.first()).toBeVisible();
});

const treeRow = (page: Page, path: string) =>
	page.getByRole("treeitem").and(page.locator(`[data-path="${path}"]`));

test("remembers what was opened in a file, and where it was left", async ({
	page,
}) => {
	await open(page, LODASH);

	const scroller = page.getByTestId("diff-scroller");
	await folds(page)
		.first()
		.getByRole("button", { name: "Expand all lines" })
		.click();
	const opened = await page.getByTestId("diff-view").getAttribute("data-rows");
	await scroller.evaluate((node) => {
		node.scrollTop = 900;
	});

	await treeRow(page, "package.json").click();
	await expect(page.getByTestId("diff-view")).toHaveAttribute(
		"data-path",
		"package.json",
	);
	await treeRow(page, "lodash.js").click();
	await expect(page.getByTestId("diff-view")).toHaveAttribute(
		"data-path",
		"lodash.js",
	);

	// Restored to the row it was left on, not the pixel.
	await expect(page.getByTestId("diff-view")).toHaveAttribute(
		"data-rows",
		opened ?? "",
	);
	const back = await scroller.evaluate((node) => node.scrollTop);
	expect(Math.abs(back - 900)).toBeLessThan(24);
});

test("a new comparison is a new file, opened at the top", async ({ page }) => {
	await open(page, LODASH);

	const fold = folds(page).first();
	const start = await fold.getAttribute("data-start");
	await fold.getByRole("button", { name: "Expand all lines" }).click();
	await page.getByTestId("diff-scroller").evaluate((node) => {
		node.scrollTop = 900;
	});

	// Chosen in the page: a page load forgets everything, so only this way could the closing viewer hand its place on.
	const from = page.getByRole("combobox", { name: "From Version" });
	await expect(from).toBeEnabled();
	await from.fill("4.17.19");
	await page.getByRole("option", { name: "4.17.19", exact: true }).click();
	await page.getByRole("button", { name: "Compare" }).click();
	await expect(page).toHaveURL("/npm/lodash/4.17.19/4.17.21/lodash.js");

	// Polled: there is no viewer while the new comparison builds.
	await expect
		.poll(
			() =>
				page.evaluate(
					() =>
						document.querySelector("[data-testid=diff-scroller]")?.scrollTop ??
						null,
				),
			ENGINE,
		)
		.toBe(0);
	await expect(
		folds(page).and(page.locator(`[data-start="${start}"]`)),
	).toHaveCount(1);
});

test("Escape closes the file and leaves the comparison open", async ({
	page,
}) => {
	await open(page, MANIFEST);

	await page.keyboard.press("Escape");

	await expect(page.getByTestId("diff-view")).toBeHidden();
	await expect(page).toHaveURL("/npm/express/4.18.2/5.1.0");
	await expect(page.getByRole("tree")).toBeVisible();
});

test("Escape in a field is the field's, not the viewer's", async ({ page }) => {
	await open(page, MANIFEST);

	await page.getByRole("combobox", { name: "Package Name" }).click();
	await page.keyboard.press("Escape");

	await expect(page.getByTestId("diff-view")).toBeVisible();
});
