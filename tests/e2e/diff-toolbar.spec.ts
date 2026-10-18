import { expect, type Page, test } from "@playwright/test";
import {
	HIGHLIGHT_THEME,
	IGNORE_WHITESPACE,
	SPLIT_VIEW,
} from "#/lib/storage/settings.ts";

const MANIFEST = "/npm/express/4.18.2/5.1.0/package.json";

const ENGINE = { timeout: 90_000 };

const toolbar = (page: Page) => page.getByTestId("diff-toolbar");

// A handful of changes in a 17 000-line file: plenty folded, and far apart.
const LODASH = "/npm/lodash/4.17.20/4.17.21/lodash.js";

async function open(page: Page, path: string) {
	await page.goto(path);
	await expect(page.getByTestId("diff-view")).toBeVisible(ENGINE);
}

const EXPRESS = "/npm/express/4.18.2/5.1.0";

test("stands whether or not a file is open", async ({ page }) => {
	await page.goto(EXPRESS);
	await expect(page.getByTestId("diff-status")).toHaveAttribute(
		"data-state",
		"ready",
		ENGINE,
	);

	await expect(page.getByTestId("tree-panel")).toBeVisible();
	await expect(toolbar(page)).toBeVisible();
	await expect(page.getByTestId("file-counter")).toHaveText("14 files");
	await expect(
		toolbar(page).getByRole("button", { name: "Next difference" }),
	).toBeDisabled();
	await expect(
		toolbar(page).getByRole("button", { name: "Close file" }),
	).toBeDisabled();
});

test("walks the changed files, and closes the one it is on", async ({
	page,
}) => {
	await open(page, MANIFEST);

	// `package.json` is the last changed file.
	await expect(page.getByTestId("file-counter")).toHaveText("14/14 files");
	await expect(
		toolbar(page).getByRole("button", { name: "Next file" }),
	).toBeDisabled();

	await toolbar(page).getByRole("button", { name: "Previous file" }).click();

	await expect(page).toHaveURL(`${EXPRESS}/lib/view.js`);
	await expect(page.getByTestId("file-counter")).toHaveText("13/14 files");

	await toolbar(page).getByRole("button", { name: "Close file" }).click();

	await expect(page).toHaveURL(EXPRESS);
	await expect(page.getByTestId("diff-view")).toHaveCount(0);
});

test("blurs the file it is holding rather than emptying the pane", async ({
	page,
}) => {
	await open(page, MANIFEST);
	const view = page.getByTestId("diff-view");

	// Set by hand: this checks the built stylesheet still matches `data-pending`.
	await expect(view).toHaveCSS("filter", "none");

	await view.evaluate((node) => node.setAttribute("data-pending", ""));

	await expect(view).toHaveCSS("filter", /blur/);
	await expect(view.locator("tr").first()).toBeVisible();
});

test("counts the differences, and scrolls to them one at a time", async ({
	page,
}) => {
	await open(page, LODASH);

	// A run of touched lines is one difference, however many lines it is.
	await expect(page.getByTestId("difference-count")).toContainText(
		/^\d+ differences$/,
	);

	const scroller = page.getByTestId("diff-scroller");
	const top = async () => scroller.evaluate((it) => it.scrollTop);
	expect(await top()).toBe(0);

	await toolbar(page).getByRole("button", { name: "Next difference" }).click();
	const first = await top();
	expect(first).toBeGreaterThan(0);

	await toolbar(page).getByRole("button", { name: "Next difference" }).click();
	expect(await top()).toBeGreaterThan(first);

	await toolbar(page)
		.getByRole("button", { name: "Previous difference" })
		.click();
	expect(await top()).toBe(first);
});

const settings = (page: Page) =>
	toolbar(page).getByRole("button", { name: "Settings" });

const themeFold = (page: Page) => page.getByTestId("theme-fold");

async function openSettings(page: Page) {
	// The gear toggles, so shut an open menu first or this click would close it.
	if (await themeFold(page).count()) await settings(page).click();
	await expect(themeFold(page)).toHaveCount(0);
	await settings(page).click();
	await expect(page.getByRole("button", { name: /whitespace/i })).toBeVisible();
}

const ignoreWhitespace = (page: Page) =>
	page.getByRole("button", { name: "Ignore whitespaces" });

// Exactly one changed pair differs only in whitespace: `git diff` says +37 -72, `git diff -w` +36 -71.
const UTILS = "/npm/express/4.18.2/5.1.0/lib/utils.js";

async function counts(page: Page, path: string) {
	const row = page
		.getByRole("treeitem")
		.and(page.locator(`[data-path="${path}"]`));
	const number = async (testId: string) =>
		Number((await row.getByTestId(testId).innerText()).replace(/[+-]/, ""));

	return { added: await number("added"), removed: await number("removed") };
}

test("the gear opens the settings, whitespace among them", async ({ page }) => {
	await open(page, MANIFEST);
	await openSettings(page);

	await expect(ignoreWhitespace(page)).toBeEnabled();
	await expect(ignoreWhitespace(page)).toHaveAttribute("aria-pressed", "false");

	await ignoreWhitespace(page).click();
	await expect(ignoreWhitespace(page)).toHaveAttribute("aria-pressed", "true");
});

test("ignoring whitespace takes a reformatted line out of the diff", async ({
	page,
}) => {
	await open(page, UTILS);
	const exact = await counts(page, "lib/utils.js");

	await openSettings(page);
	await ignoreWhitespace(page).click();
	await expect(page.getByTestId("diff-status")).toHaveAttribute(
		"data-state",
		"ready",
		ENGINE,
	);
	await expect(page.getByTestId("diff-view")).toBeVisible(ENGINE);

	const ignored = await counts(page, "lib/utils.js");
	expect(ignored.added).toBe(exact.added - 1);
	expect(ignored.removed).toBe(exact.removed - 1);
});

test("the choice survives a reload, the way the layout does", async ({
	page,
}) => {
	await open(page, MANIFEST);
	await openSettings(page);
	await ignoreWhitespace(page).click();

	await page.reload();
	await expect(page.getByTestId("diff-view")).toBeVisible(ENGINE);
	await openSettings(page);
	await expect(ignoreWhitespace(page)).toHaveAttribute("aria-pressed", "true");

	// The stored key too: checking only the button would let a renamed key drop returning visitors' choice.
	expect(
		await page.evaluate(
			(key) => localStorage.getItem(key),
			IGNORE_WHITESPACE.key,
		),
	).toBe("true");
});

test("names the file being read", async ({ page }) => {
	await open(page, MANIFEST);

	await expect(toolbar(page)).toContainText("package.json");
});

test("opens the whole file, and folds it back up", async ({ page }) => {
	await open(page, LODASH);

	const viewer = page.getByTestId("diff-view");
	const folded = await viewer.getAttribute("data-rows");
	await toolbar(page).getByRole("button", { name: "Expand all" }).click();

	await expect(page.getByTestId("fold")).toHaveCount(0);
	await expect(viewer).not.toHaveAttribute("data-rows", folded ?? "");

	await toolbar(page).getByRole("button", { name: "Fold all" }).click();

	await expect(viewer).toHaveAttribute("data-rows", folded ?? "");
});

const splitRows = (page: Page) =>
	page.getByTestId("diff-view").locator("tr[data-left-type]");

test("puts the old file beside the new one, and remembers that it was asked", async ({
	page,
}) => {
	await open(page, MANIFEST);

	await expect(splitRows(page)).toHaveCount(0);
	await toolbar(page)
		.getByRole("button", { name: "Switch to split view" })
		.click();

	await expect(splitRows(page).first()).toBeVisible();
	// The old app's key, so a returning visitor's choice still stands.
	expect(
		await page.evaluate((key) => localStorage.getItem(key), SPLIT_VIEW.key),
	).toBe("true");

	await toolbar(page)
		.getByRole("button", { name: "Switch to unified view" })
		.click();

	await expect(splitRows(page)).toHaveCount(0);
	expect(
		await page.evaluate((key) => localStorage.getItem(key), SPLIT_VIEW.key),
	).toBe("false");
});

test("counts the same differences however the file is shown", async ({
	page,
}) => {
	await open(page, LODASH);
	const count = page.getByTestId("difference-count");
	const folded = await count.innerText();

	// The count comes from the rows on screen; neither expanding nor splitting may split or join a difference.
	await toolbar(page).getByRole("button", { name: "Expand all" }).click();
	await expect(page.getByTestId("fold")).toHaveCount(0);
	await expect(count).toHaveText(folded);

	await toolbar(page)
		.getByRole("button", { name: "Switch to split view" })
		.click();
	await expect(splitRows(page).first()).toBeVisible();
	await expect(count).toHaveText(folded);
});

const themeLink = (page: Page) => page.locator("link#highlight-theme");

async function openThemes(page: Page) {
	await openSettings(page);
	await themeFold(page).click();
	await expect(
		page.getByRole("button", { name: "Nord", exact: true }),
	).toBeVisible();
}

test("themes the code, and remembers which theme", async ({ page }) => {
	await open(page, MANIFEST);
	await openThemes(page);

	await page.getByRole("button", { name: "Nord", exact: true }).click();

	await expect(themeLink(page)).toHaveAttribute("href", /nord/);
	// `highlight_theme` is the old app's key, so a returning visitor's theme is
	// still theirs.
	expect(
		await page.evaluate(
			(key) => localStorage.getItem(key),
			HIGHLIGHT_THEME.key,
		),
	).toBe("nord");
});

test("names the theme in force, and ticks it among the rest", async ({
	page,
}) => {
	await open(page, MANIFEST);
	await openThemes(page);

	await page.getByRole("button", { name: "Nord", exact: true }).click();
	await openSettings(page);

	await expect(themeFold(page)).toContainText("Nord");

	await themeFold(page).click();

	await expect(page.locator('[data-theme="nord"]')).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await expect(page.locator('[data-theme="github-dark"]')).toHaveAttribute(
		"aria-pressed",
		"false",
	);
});

test("the fold shows every theme it has, rather than clipping them", async ({
	page,
}) => {
	await open(page, MANIFEST);
	await openThemes(page);

	const overflow = await page
		.getByTestId("theme-popup")
		.evaluate((node) => node.scrollHeight - node.clientHeight);
	expect(overflow).toBe(0);
	await expect(page.getByTestId("theme-option").last()).toHaveAttribute(
		"data-theme",
		"windows-95",
	);
});

test("every theme it offers is one it can serve", async ({ page }) => {
	await open(page, MANIFEST);
	await openThemes(page);

	const themes = page.getByTestId("theme-option");
	const values = await themes.evaluateAll((nodes) =>
		nodes.map((node) => node.getAttribute("data-theme") ?? ""),
	);
	expect(values).toHaveLength(23);

	// The build emits only the stylesheets named one by one; a theme missing there colours nothing.
	for (const value of values) {
		await openThemes(page);
		await page.locator(`[data-theme="${value}"]`).click();
		// Otherwise a missing theme leaves the previous `<link>` in place and looks like it worked.
		const name = value.split("/").at(-1) ?? value;
		await expect(themeLink(page), value).toHaveAttribute(
			"href",
			new RegExp(name),
		);

		const href = await themeLink(page).getAttribute("href");
		const response = await page.request.get(href ?? "");
		expect(response.status(), value).toBe(200);
	}
});

// Luma (0–1) of the scroller's ground and every row wash; a coherent theme keeps them all on one side of 0.5.
async function surfaceLumas(page: Page) {
	return page.evaluate(() => {
		const luma = (color: string) => {
			const [r = 0, g = 0, b = 0] = (color.match(/\d+(\.\d+)?/g) ?? []).map(
				Number,
			);
			return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
		};
		const opaque = (node: Element) => {
			const background = getComputedStyle(node).backgroundColor;
			// A transparent row shows the scroller's ground and proves nothing.
			return background.startsWith("rgba(0, 0, 0, 0") ? null : background;
		};

		const scroller = document.querySelector('[data-testid="diff-scroller"]');
		if (!scroller) throw new Error("no scroller");

		const rows = [...scroller.querySelectorAll("tr")]
			.map(opaque)
			.filter((background) => background !== null);

		return [getComputedStyle(scroller).backgroundColor, ...rows].map(luma);
	});
}

test("a light syntax theme brings the whole viewer with it, dark page or not", async ({
	page,
}) => {
	await open(page, MANIFEST);
	// A dark page with a light syntax theme once gave alternating light and dark rows (#139).
	await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

	await openThemes(page);
	await page
		.getByRole("button", { name: "Atom One Light", exact: true })
		.click();

	await expect(page.getByTestId("diff-view")).toHaveAttribute(
		"data-syntax",
		"light",
	);
	for (const luma of await surfaceLumas(page))
		expect(luma).toBeGreaterThan(0.5);

	// And back, so it is the syntax theme deciding rather than a viewer that is always light.
	await openThemes(page);
	await page.getByRole("button", { name: "Monokai", exact: true }).click();

	await expect(page.getByTestId("diff-view")).toHaveAttribute(
		"data-syntax",
		"dark",
	);
	for (const luma of await surfaceLumas(page)) expect(luma).toBeLessThan(0.5);
});

test("colours the code by what the tokens are", async ({ page }) => {
	await open(page, MANIFEST);

	// From the file name: with both versions of each key interleaved, auto-detection says Perl.
	await expect(page.getByTestId("diff-view")).toHaveAttribute(
		"data-language",
		"json",
	);

	await expect(
		page.getByTestId("diff-view").locator("span.hljs-attr").first(),
	).toBeVisible();
});
