import { expect, type Locator, type Page, test } from "@playwright/test";
import { FILE_LAYOUT, VIEWED_FILES } from "#/lib/storage/settings.ts";

const EXPRESS = "/npm/express/4.18.2/5.1.0";
const CHANGED_FILES = 14;

const ENGINE = { timeout: 90_000 };

const stream = (page: Page) => page.getByTestId("file-stream");
const cards = (page: Page) => page.getByTestId("stream-file");
const card = (page: Page, path: string) =>
	cards(page).and(page.locator(`[data-path="${path}"]`));
const treeFile = (page: Page, path: string) =>
	page.getByRole("treeitem").and(page.locator(`[data-path="${path}"]`));

async function ready(page: Page) {
	await expect(page.getByTestId("workspace")).toHaveAttribute(
		"data-state",
		"ready",
		ENGINE,
	);
}

async function showAllFiles(page: Page) {
	await page.goto(EXPRESS);
	await ready(page);
	await page.getByTestId("layout-all").click();
	await expect(cards(page)).toHaveCount(CHANGED_FILES);
}

async function cardPaths(page: Page): Promise<string[]> {
	return cards(page).evaluateAll((nodes) =>
		nodes.map((node) => node.getAttribute("data-path") ?? ""),
	);
}

async function markViewed(target: Locator) {
	await target.getByTestId("viewed-toggle").check();
	await expect(target).toHaveAttribute("data-viewed");
}

async function storedItem(page: Page, key: string) {
	return page.evaluate((name) => localStorage.getItem(name), key);
}

test("one file at a time is the default", async ({ page }) => {
	await page.goto(EXPRESS);
	await ready(page);

	await expect(page.getByTestId("layout-single")).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await expect(page.getByTestId("layout-all")).toHaveAttribute(
		"aria-pressed",
		"false",
	);
	await expect(stream(page)).toHaveCount(0);
});

test("shows no ASCII trail behind the files", async ({ page }) => {
	await showAllFiles(page);

	await expect(page.getByTestId("ascii-trail")).toHaveCount(0);
});

test("shows every changed file without the summary, and remembers the choice", async ({
	page,
}) => {
	await showAllFiles(page);

	await expect(page.getByTestId("layout-all")).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await expect(stream(page)).toBeVisible();

	await expect(cards(page).first()).toBeVisible();
	await expect(page.getByTestId("diff-summary")).toHaveCount(0);

	const treePaths = await page
		.getByRole("treeitem")
		.and(page.locator("[data-type='file']"))
		.evaluateAll((nodes) =>
			nodes.map((node) => node.getAttribute("data-path") ?? ""),
		);
	expect(await cardPaths(page)).toEqual(treePaths);

	expect(await storedItem(page, FILE_LAYOUT.key)).toBe("all");

	await page.reload();
	await ready(page);
	await expect(page.getByTestId("layout-all")).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await expect(cards(page)).toHaveCount(CHANGED_FILES);

	await page.getByTestId("layout-single").click();
	await expect(stream(page)).toHaveCount(0);
	await expect(page.getByTestId("diff-summary")).toBeVisible();
	expect(await storedItem(page, FILE_LAYOUT.key)).toBe("single");
});

test("loads the files at the top of the stream", async ({ page }) => {
	await showAllFiles(page);

	const first = cards(page).first();
	await expect(first).toHaveAttribute("data-state", "ready", ENGINE);
	await expect(first.getByTestId("stream-rows")).toBeVisible();
	await expect(
		first.getByTestId("stream-rows").locator("tr").first(),
	).toBeVisible();
});

test("a viewed file folds away and stays viewed", async ({ page }) => {
	await showAllFiles(page);

	const [path = ""] = await cardPaths(page);
	const target = card(page, path);
	await expect(target).toHaveAttribute("data-state", "ready", ENGINE);
	await markViewed(target);

	await expect(target).toHaveAttribute("data-collapsed");
	await expect(target.getByTestId("stream-rows")).toBeHidden();
	await expect(treeFile(page, path)).toHaveAttribute("data-viewed");
	await expect(treeFile(page, path).getByTestId("viewed-mark")).toBeVisible();
	expect(await storedItem(page, VIEWED_FILES.key)).toContain(path);

	await page.reload();
	await ready(page);

	await expect(card(page, path)).toHaveAttribute("data-viewed");
	await expect(card(page, path)).toHaveAttribute("data-collapsed");
	await expect(card(page, path).getByTestId("viewed-toggle")).toBeChecked();
	await expect(treeFile(page, path)).toHaveAttribute("data-viewed");

	await card(page, path).getByTestId("viewed-toggle").uncheck();
	await expect(card(page, path)).not.toHaveAttribute("data-viewed");
	await expect(treeFile(page, path)).not.toHaveAttribute("data-viewed");
});

test("a double click on a file's header folds and unfolds it", async ({
	page,
}) => {
	await showAllFiles(page);
	const [path = ""] = await cardPaths(page);
	const target = card(page, path);
	await expect(target).toHaveAttribute("data-state", "ready", ENGINE);
	await target.getByTestId("collapse-file").click();
	await expect(target).toHaveAttribute("data-collapsed");

	await target.getByRole("heading").dblclick();

	await expect(target).not.toHaveAttribute("data-collapsed");
	await expect(target.getByTestId("stream-rows")).toBeVisible();

	await target.getByRole("heading").dblclick();

	await expect(target).toHaveAttribute("data-collapsed");
});

test("hide viewed, in the tree's menu, takes viewed files out of the tree", async ({
	page,
}) => {
	await showAllFiles(page);
	const [path = ""] = await cardPaths(page);
	await page.getByRole("button", { name: "File tree options" }).click();
	const hideViewed = page.getByRole("button", {
		name: "Hide viewed",
		exact: true,
	});
	await expect(hideViewed).toHaveAttribute("aria-pressed", "false");
	await hideViewed.click();
	await expect(hideViewed).toHaveAttribute("aria-pressed", "true");
	await page.keyboard.press("Escape");

	const target = card(page, path);
	await expect(target).toHaveAttribute("data-state", "ready", ENGINE);
	await markViewed(target);

	await expect(treeFile(page, path)).toHaveCount(0);
	await expect(target).toBeVisible();

	await target.getByTestId("viewed-toggle").uncheck();
	await expect(treeFile(page, path)).toBeVisible();
});

test("a file picked in the tree scrolls into view without leaving the comparison", async ({
	page,
}) => {
	await showAllFiles(page);
	const paths = await cardPaths(page);
	const middle = paths[Math.floor(paths.length / 2)] ?? "";
	const last = paths.at(-1) ?? "";

	await treeFile(page, middle).click();

	await expect(card(page, middle)).toBeInViewport();
	await expect(stream(page)).toHaveAttribute("data-current", middle);
	await expect(page).toHaveURL(EXPRESS);

	await treeFile(page, last).click();

	await expect(card(page, last)).toBeInViewport();
	await expect(page).toHaveURL(EXPRESS);
});

test("a card opens its file on its own", async ({ page }) => {
	await showAllFiles(page);
	const [path = ""] = await cardPaths(page);

	await card(page, path).getByTestId("open-file").click();

	await expect(page).toHaveURL(`${EXPRESS}/${path}`);
	await expect(page.getByTestId("diff-view")).toHaveAttribute(
		"data-path",
		path,
		ENGINE,
	);
});

test("v folds the file being read and stays on it", async ({ page }) => {
	await showAllFiles(page);
	const [first = ""] = await cardPaths(page);
	const target = card(page, first);
	await expect(target).toHaveAttribute("data-state", "ready", ENGINE);
	await stream(page).evaluate((element) => element.scrollBy(0, 600));
	await expect(stream(page)).toHaveAttribute("data-current", first);

	await page.keyboard.press("v");

	await expect(target).toHaveAttribute("data-collapsed");
	await expect(target).toBeInViewport();
	await expect(stream(page)).toHaveAttribute("data-current", first);
});

test("n jumps to the next file not yet viewed", async ({ page }) => {
	await showAllFiles(page);
	const [first = "", second = "", third = "", fourth = ""] =
		await cardPaths(page);

	await expect(card(page, first)).toHaveAttribute(
		"data-state",
		"ready",
		ENGINE,
	);
	await markViewed(card(page, first));
	await expect(card(page, second)).toHaveAttribute(
		"data-state",
		"ready",
		ENGINE,
	);
	await markViewed(card(page, second));

	await page.keyboard.press("n");

	await expect(stream(page)).toHaveAttribute("data-current", third);
	await expect(card(page, third)).toBeInViewport();

	await page.keyboard.press("n");

	await expect(stream(page)).toHaveAttribute("data-current", fourth);
	await expect(card(page, fourth)).toBeInViewport();
});

test("the stream's scrollbar sits beside the cards and scrolls the stream", async ({
	page,
}) => {
	await showAllFiles(page);
	const scrollbar = page.getByTestId("diff-scrollbar");
	await expect(scrollbar).toHaveAttribute("data-shown", "true");

	const track = await scrollbar.boundingBox();
	const first = await cards(page).first().boundingBox();
	if (!track || !first) throw new Error("no scrollbar or card");
	expect(track.x).toBeGreaterThanOrEqual(first.x + first.width);

	await page.mouse.click(track.x + track.width / 2, track.y + track.height - 8);

	await expect
		.poll(() => stream(page).evaluate((element) => element.scrollTop))
		.toBeGreaterThan(0);
});

async function firstReadyCard(page: Page) {
	await showAllFiles(page);
	const [path = ""] = await cardPaths(page);
	const target = card(page, path);
	await expect(target).toHaveAttribute("data-state", "ready", ENGINE);
	return { path, target };
}

test("a double click on a control in a file's header leaves the file open", async ({
	page,
}) => {
	const { target } = await firstReadyCard(page);
	const header = target.locator("header");

	await header.getByTestId("collapse-file").dblclick();
	await expect(target).not.toHaveAttribute("data-collapsed");

	await header.getByRole("button", { name: "Expand all lines" }).dblclick();
	await expect(target).not.toHaveAttribute("data-collapsed");

	await header.getByTestId("viewed-toggle").dblclick();
	await expect(header.getByTestId("viewed-toggle")).not.toBeChecked();
	await expect(target).not.toHaveAttribute("data-collapsed");
	await expect(target.getByTestId("stream-rows")).toBeVisible();
});

test("expanding every line of a folded file leaves it folded", async ({
	page,
}) => {
	const { target } = await firstReadyCard(page);
	await target.getByTestId("collapse-file").click();
	await expect(target).toHaveAttribute("data-collapsed");

	await target.getByRole("button", { name: "Expand all lines" }).click();

	await expect(
		target.getByRole("button", { name: "Fold all lines" }),
	).toHaveAttribute("aria-pressed", "true");
	await expect(target).toHaveAttribute("data-collapsed");
	await expect(target.getByTestId("stream-rows")).toHaveCount(0);
});

test("the viewed toggle shows its V key and answers the space bar", async ({
	page,
}) => {
	const { target } = await firstReadyCard(page);
	const viewed = target.getByTestId("viewed-toggle");

	await expect(viewed).toHaveText("ViewedV");
	await expect(viewed.locator("kbd")).toHaveText("V");
	await expect(viewed).toHaveAttribute("aria-keyshortcuts", "V");

	await viewed.focus();
	await page.keyboard.press("Space");

	await expect(viewed).toBeChecked();
	await expect(target).toHaveAttribute("data-collapsed");

	await page.keyboard.press("Space");

	await expect(viewed).not.toBeChecked();
	await expect(target).not.toHaveAttribute("data-collapsed");
});

test("ticking viewed folds the file being read and stays on it", async ({
	page,
}) => {
	const { path, target } = await firstReadyCard(page);
	await stream(page).evaluate((element) => element.scrollBy(0, 600));
	await expect(stream(page)).toHaveAttribute("data-current", path);

	await markViewed(target);

	await expect(target).toHaveAttribute("data-collapsed");
	await expect(target).toBeInViewport();
	await expect(stream(page)).toHaveAttribute("data-current", path);
});

test("cards open their file but have nothing to close", async ({ page }) => {
	await showAllFiles(page);

	await expect(stream(page).getByTestId("open-file")).toHaveCount(
		CHANGED_FILES,
	);
	await expect(stream(page).getByTestId("close-file")).toHaveCount(0);
});

test("a card's header is as tall as the toolbar, which counts no differences", async ({
	page,
}) => {
	await showAllFiles(page);
	const toolbar = page.getByTestId("diff-toolbar");

	const headerBox = await cards(page).first().locator("header").boundingBox();
	const toolbarBox = await toolbar.boundingBox();
	expect(headerBox?.height).toBe(toolbarBox?.height);
	await expect(page.getByTestId("difference-count")).toHaveCount(0);
	await expect(toolbar.getByRole("button", { name: "Expand all" })).toHaveCount(
		0,
	);
	await expect(toolbar.getByRole("button", { name: "Close file" })).toHaveCount(
		0,
	);
});

test("a double click on a file's header leaves nothing selected", async ({
	page,
}) => {
	const { target } = await firstReadyCard(page);

	await target.getByRole("heading").dblclick();

	await expect(target).toHaveAttribute("data-collapsed");
	expect(await page.evaluate(() => String(window.getSelection()))).toBe("");
});
