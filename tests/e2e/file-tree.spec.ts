import { gzipSync } from "node:zlib";
import { expect, type Locator, type Page, test } from "@playwright/test";
import {
	ONLY_MODIFIED,
	TREE_COLLAPSED,
	TREE_LINE_COUNTS,
	TREE_WIDTH,
} from "#/lib/storage/settings.ts";

const EXPRESS = "/npm/express/4.18.2/5.1.0";

const ENGINE = { timeout: 90_000 };

const tree = (page: Page) => page.getByRole("tree");
const row = (page: Page, name: string | RegExp) =>
	page.getByRole("treeitem").filter({ hasText: name });

async function ready(page: Page) {
	await expect(page.getByTestId("workspace")).toHaveAttribute(
		"data-state",
		"ready",
		ENGINE,
	);
}

// Stubbed for a tree one folder deep, which no real package has: each keeps its manifest at the root.
const MADE_UP = "diffpack-made-up";

const MADE_UP_FILES: Record<string, Record<string, string>> = {
	"0.9.0": { "README.md": "one\n", "lib/index.js": "let one;\n" },
	// Changed from 0.9.0 only in whitespace.
	"1.0.0": { "README.md": "one\n", "lib/index.js": "let  one;\n" },
	// Everything under `src/`, and nothing beside it.
	"2.0.0": { "src/index.js": "two\n" },
	"3.0.0": { "src/index.js": "three\n" },
	// Adds a folder inside `src/`.
	"4.0.0": { "src/index.js": "four\n", "src/utils/a.js": "let a;\n" },
	// `lib` is a file here and a folder in 6.0.0; the contents differ, or the engine sees a rename.
	"5.0.0": { "README.md": "five\n", lib: "module.exports = 5;\n" },
	"6.0.0": {
		"README.md": "five\n",
		"lib/index.js": "export const six = 6;\nexport default six;\n",
	},
};

async function serveMadeUpPackage(page: Page) {
	const registry = `https://registry.npmjs.org/${MADE_UP}`;
	const versions = Object.fromEntries(
		Object.keys(MADE_UP_FILES).map((version) => [version, {}]),
	);
	await page.route(registry, (route) => route.fulfill({ json: { versions } }));
	// The engine fetches from its worker, whose requests `page.route` also intercepts.
	await page.route(`${registry}/-/*`, (route) => {
		const version = /-([\d.]+)\.tgz$/.exec(route.request().url())?.[1] ?? "";
		const files = MADE_UP_FILES[version];
		return files ? route.fulfill({ body: tarball(files) }) : route.abort();
	});
}

// npm's layout: every file under `package/`, which the engine strips.
function tarball(files: Record<string, string>): Buffer {
	const blocks = Object.entries(files).flatMap(([path, text]) => {
		const content = Buffer.from(text);
		const padding = (512 - (content.length % 512)) % 512;
		return [
			tarHeader(`package/${path}`, content.length),
			content,
			Buffer.alloc(padding),
		];
	});

	return gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024)]));
}

function tarHeader(path: string, size: number): Buffer {
	const header = Buffer.alloc(512);
	header.write(path, 0);
	header.write("0000644", 100);
	header.write(size.toString(8).padStart(11, "0"), 124);
	header.write("0", 156); // a regular file
	header.write("ustar\u000000", 257);
	// The checksum sums the header with its own field counted as eight spaces.
	header.write(" ".repeat(8), 148);
	const sum = header.reduce((total, byte) => total + byte, 0);
	header.write(`${sum.toString(8).padStart(6, "0")}\u0000 `, 148);

	return header;
}

test("shows the comparison as a tree of folders and files", async ({
	page,
}) => {
	await page.goto(EXPRESS);
	await ready(page);

	await expect(tree(page)).toBeVisible();
	await expect(row(page, "package.json")).toBeVisible();
	await expect(row(page, "lib").first()).toBeVisible();
});

test("marks each changed file with a coloured status file icon, and keeps names plain", async ({
	page,
}) => {
	await page.goto(EXPRESS);
	await ready(page);

	const manifest = row(page, "package.json");
	const removed = row(page, "query.js");
	const modifiedIcon = manifest.getByTestId("icon");
	const removedIcon = removed.getByTestId("icon");
	await expect(modifiedIcon).toHaveAttribute("data-icon", "file-diff");
	await expect(modifiedIcon).toHaveAccessibleName("Modified");
	await expect(removedIcon).toHaveAttribute("data-icon", "file-removed");
	await expect(removedIcon).toHaveAccessibleName("Removed");

	const modifiedColour = await tokenColour(page, "--color-renamed");
	const removedColour = await tokenColour(page, "--color-removed");
	const foreground = await tokenColour(page, "--color-foreground");
	await expect(modifiedIcon).toHaveCSS("color", modifiedColour);
	await expect(removedIcon).toHaveCSS("color", removedColour);
	await expect(manifest.getByTestId("name")).toHaveCSS("color", foreground);
	await expect(removed.getByTestId("name")).toHaveCSS("color", foreground);
	await expect(manifest.getByTestId("added")).toHaveCount(0);
});

async function tokenColour(page: Page, token: string): Promise<string> {
	return page.evaluate((name) => {
		const probe = document.createElement("span");
		probe.style.color = `var(${name})`;
		document.querySelector("[role='tree']")?.append(probe);
		const colour = getComputedStyle(probe).color;
		probe.remove();
		return colour;
	}, token);
}

test("opens on what changed, without the untouched files", async ({ page }) => {
	await page.goto(EXPRESS);
	await ready(page);

	// only-modified is on by default, and folders on the way to a change open themselves.
	await expect(row(page, "query.js")).toBeVisible();
	await expect(row(page, "query.js")).toHaveAttribute("data-status", "removed");
	await expect(
		page.locator("[role='treeitem'][data-status='unchanged']"),
	).toHaveCount(0);
});

test("filtering narrows the tree to what matches, and opens the way to it", async ({
	page,
}) => {
	await page.goto(EXPRESS);
	await ready(page);

	await page
		.getByRole("searchbox", { name: "Filter files and folders" })
		.fill("router");

	await expect(row(page, "layer.js")).toBeVisible();
	await expect(row(page, "package.json")).toHaveCount(0);
});

const treeOptions = (page: Page) =>
	page.getByRole("button", { name: "File tree options" });
const option = (page: Page, name: string) =>
	page.getByRole("button", { name, exact: true });

async function openTreeOptions(page: Page) {
	await treeOptions(page).click();
	await expect(option(page, "Only modified")).toBeVisible();
}

test("only modified, in the tree's menu, brings the unchanged files back, and remembers it", async ({
	page,
}) => {
	await page.goto(EXPRESS);
	await ready(page);
	await openTreeOptions(page);
	await expect(option(page, "Only modified")).toHaveAttribute(
		"aria-pressed",
		"true",
	);

	await option(page, "Only modified").click();

	await expect(option(page, "Only modified")).toHaveAttribute(
		"aria-pressed",
		"false",
	);
	await expect(
		page.locator("[role='treeitem'][data-status='unchanged']").first(),
	).toBeVisible();

	await page.reload();
	await ready(page);
	await openTreeOptions(page);

	await expect(option(page, "Only modified")).toHaveAttribute(
		"aria-pressed",
		"false",
	);
});

test("line counts, in the tree's menu, show how much each file changed, and are remembered", async ({
	page,
}) => {
	await page.goto(EXPRESS);
	await ready(page);
	const manifest = row(page, "package.json");
	await openTreeOptions(page);
	await expect(option(page, "Line counts")).toHaveAttribute(
		"aria-pressed",
		"false",
	);

	await option(page, "Line counts").click();

	await expect(option(page, "Line counts")).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	// Shape, not numbers: the counts come from the engine and real archives.
	await expect(manifest.getByTestId("added")).toHaveText(/^\+\d+$/);
	await expect(manifest.getByTestId("removed")).toHaveText(/^-\d+$/);
	await expect(row(page, "lib").first().getByTestId("removed")).toHaveText(
		/^-\d+$/,
	);
	expect(
		await page.evaluate(
			(key) => localStorage.getItem(key),
			TREE_LINE_COUNTS.key,
		),
	).toBe("true");

	await page.reload();
	await ready(page);
	await expect(manifest.getByTestId("added")).toHaveText(/^\+\d+$/);
});

test("a folder opens and shuts on click, and stays shut", async ({ page }) => {
	await page.goto(EXPRESS);
	await ready(page);
	const middleware = row(page, "middleware");
	await expect(middleware).toHaveAttribute("aria-expanded", "true");

	await middleware.click();

	// Closing by hand outranks the auto-expansion only-modified would do.
	await expect(middleware).toHaveAttribute("aria-expanded", "false");
	await expect(row(page, "query.js")).toHaveCount(0);

	await middleware.click();

	await expect(row(page, "query.js")).toBeVisible();
});

test("a new comparison starts with no folders chosen, and opens its only folder", async ({
	page,
}) => {
	await serveMadeUpPackage(page);
	// Off, or only-modified would open `src` whatever had carried over.
	await page.addInitScript((key) => {
		localStorage.setItem(key, "false");
	}, ONLY_MODIFIED.key);
	await page.goto(`/npm/${MADE_UP}/2.0.0/3.0.0`);
	await ready(page);
	const src = row(page, "src");
	await expect(src).toHaveAttribute("aria-expanded", "true");

	await src.click();
	await expect(src).toHaveAttribute("aria-expanded", "false");

	// Chosen in the page: a page load forgets every folder, so only this way could one carry over.
	const to = page.getByRole("combobox", { name: "To Version" });
	await to.fill("4.0.0");
	await page.getByRole("option", { name: "4.0.0", exact: true }).click();
	await page.getByRole("button", { name: "Compare" }).click();
	await expect(page).toHaveURL(`/npm/${MADE_UP}/2.0.0/4.0.0`);

	// The count proves this is the new tree; `src`, shut in the last one, must not stay shut.
	await expect(page.getByTestId("summary-files")).toHaveText(
		"2 files, 2 changed",
		ENGINE,
	);
	await expect(src).toHaveAttribute("aria-expanded", "true");
	await expect(row(page, "utils")).toBeVisible();
});

test("opening a folder inside the only folder leaves the only folder open", async ({
	page,
}) => {
	await serveMadeUpPackage(page);
	// Off, so auto-opening cannot hide `src` shutting.
	await page.addInitScript((key) => {
		localStorage.setItem(key, "false");
	}, ONLY_MODIFIED.key);
	await page.goto(`/npm/${MADE_UP}/3.0.0/4.0.0`);
	await ready(page);
	const src = row(page, "src");
	const utils = row(page, "utils");
	await expect(src).toHaveAttribute("aria-expanded", "true");
	await expect(utils).toHaveAttribute("aria-expanded", "false");

	await utils.click();

	await expect(utils).toHaveAttribute("aria-expanded", "true");
	await expect(src).toHaveAttribute("aria-expanded", "true");
	await expect(row(page, "a.js")).toBeVisible();
	await expect(row(page, "index.js")).toBeVisible();
});

test("the same comparison keeps its folders, with another file open or whitespace ignored", async ({
	page,
}) => {
	await serveMadeUpPackage(page);
	// Off, so the file stays listed once it counts as unchanged.
	await page.addInitScript((key) => {
		localStorage.setItem(key, "false");
	}, ONLY_MODIFIED.key);
	await page.goto(`/npm/${MADE_UP}/0.9.0/1.0.0`);
	await ready(page);
	const lib = row(page, "lib");
	const index = row(page, "index.js");
	await lib.click();

	await index.click();
	await expect(page).toHaveURL(`/npm/${MADE_UP}/0.9.0/1.0.0/lib/index.js`);
	await expect(index).toHaveAttribute("aria-selected", "true");
	await expect(lib).toHaveAttribute("aria-expanded", "true");

	// Rebuilt with whitespace ignored; the same two versions keep their folders.
	await page.getByRole("button", { name: "Settings" }).click();
	await page.getByRole("button", { name: "Ignore whitespaces" }).click();
	await expect(index).toHaveAttribute("data-status", "unchanged", ENGINE);
	await expect(lib).toHaveAttribute("aria-expanded", "true");
});

test("a path that is a file in one version and a folder in the other is two rows, each its own", async ({
	page,
}) => {
	await serveMadeUpPackage(page);
	// Only what changed, so the folder opens itself on the way to its file.
	await page.addInitScript((key) => {
		localStorage.setItem(key, "true");
	}, ONLY_MODIFIED.key);
	await page.goto(`/npm/${MADE_UP}/5.0.0/6.0.0`);
	await ready(page);
	const at = (type: string) =>
		page.locator(`[role="treeitem"][data-path="lib"][data-type="${type}"]`);
	const file = at("file");
	const folder = at("directory");
	// The old version's first, the way a diff reads.
	await expect(file).toHaveAttribute("data-status", "removed");
	await expect(folder).toHaveAttribute("aria-expanded", "true");
	await expect(row(page, "index.js")).toBeVisible();

	await file.click();

	await expect(page).toHaveURL(`/npm/${MADE_UP}/5.0.0/6.0.0/lib`);
	await expect(file).toHaveAttribute("aria-selected", "true");
	await expect(folder).toHaveAttribute("aria-selected", "false");
	await expect(page.locator('[role="treeitem"][tabindex="0"]')).toHaveCount(1);

	await page.keyboard.press("ArrowDown");
	await expect(folder).toBeFocused();
	await page.keyboard.press("ArrowDown");
	await expect(row(page, "index.js")).toBeFocused();
});

test("every row is 30px high", async ({ page }) => {
	await page.goto(EXPRESS);
	await ready(page);

	await expect(row(page, "package.json")).toHaveCSS("height", "30px");
	await expect(row(page, "lib").first()).toHaveCSS("height", "30px");
});

test("rows appear at once, without a rise-in animation", async ({ page }) => {
	await page.goto(EXPRESS);
	await ready(page);

	const animation = await row(page, "package.json").evaluate(
		(node) => getComputedStyle(node).animationName,
	);

	expect(animation).toBe("none");
});

test("shows at a glance which rows open and which are files", async ({
	page,
}) => {
	await page.goto(EXPRESS);
	await ready(page);

	const middleware = row(page, "middleware");
	await expect(middleware.getByTestId("chevron")).toHaveAttribute(
		"data-expanded",
		"true",
	);
	await expect(middleware.getByTestId("icon")).toHaveAttribute(
		"data-icon",
		"folder-open",
	);

	await middleware.click();

	await expect(middleware.getByTestId("chevron")).toHaveAttribute(
		"data-expanded",
		"false",
	);
	await expect(middleware.getByTestId("icon")).toHaveAttribute(
		"data-icon",
		"folder",
	);
	await expect(row(page, "package.json").getByTestId("chevron")).toHaveCount(0);
	await expect(row(page, "package.json").getByTestId("icon")).toHaveAttribute(
		"data-icon",
		"file-diff",
	);
});

test("the tree is one tab stop, and the arrows move inside it", async ({
	page,
}) => {
	await page.goto(EXPRESS);
	await ready(page);
	const rows = page.getByRole("treeitem");

	await expect(rows.first()).toHaveAttribute("tabindex", "0");
	await expect(page.locator("[role='treeitem'][tabindex='0']")).toHaveCount(1);

	await rows.first().focus();
	await page.keyboard.press("ArrowDown");

	await expect(rows.nth(1)).toBeFocused();
	await expect(rows.nth(1)).toHaveAttribute("tabindex", "0");
	await expect(page.locator("[role='treeitem'][tabindex='0']")).toHaveCount(1);

	await page.keyboard.press("ArrowUp");
	await expect(rows.first()).toBeFocused();

	await page.keyboard.press("End");
	await expect(rows.last()).toBeFocused();

	await page.keyboard.press("Home");
	await expect(rows.first()).toBeFocused();
});

test("left and right walk the folder structure", async ({ page }) => {
	await page.goto(EXPRESS);
	await ready(page);
	const middleware = row(page, "middleware");

	await middleware.focus();
	await page.keyboard.press("ArrowLeft");

	await expect(middleware).toHaveAttribute("aria-expanded", "false");
	await page.keyboard.press("ArrowLeft");
	await expect(row(page, "lib").first()).toBeFocused();

	await page.keyboard.press("ArrowRight");
	await page.keyboard.press("ArrowRight");

	await expect(row(page, "application.js")).toBeFocused();
});

test("Enter opens the focused file", async ({ page }) => {
	await page.goto(EXPRESS);
	await ready(page);

	await row(page, "package.json").focus();
	await page.keyboard.press("Enter");

	await expect(page).toHaveURL(`${EXPRESS}/package.json`);
	await expect(row(page, "package.json")).toHaveAttribute(
		"aria-selected",
		"true",
	);
});

test("sums up the comparison in a box centred on the window, inside the diff area", async ({
	page,
}) => {
	await page.goto(EXPRESS);
	await ready(page);

	const summary = page.getByTestId("diff-summary");
	await expect(summary.getByTestId("summary-files")).toHaveText(
		/^\d+ files, \d+ changed$/,
	);
	await expect(summary.getByTestId("summary-added")).toHaveText(/^\+[\d,]+$/);
	await expect(summary.getByTestId("summary-removed")).toHaveText(/^-[\d,]+$/);

	const box = (await summary.boundingBox()) ?? {
		x: 0,
		y: 0,
		width: 0,
		height: 0,
	};
	const area = (await page.getByRole("main").boundingBox()) ?? {
		x: 0,
		y: 0,
		width: 0,
		height: 0,
	};
	const window = page.viewportSize() ?? { width: 0, height: 0 };
	expect(Math.abs(box.y + box.height / 2 - window.height / 2)).toBeLessThan(2);
	expect(
		Math.abs(box.x + box.width / 2 - (area.x + area.width / 2)),
	).toBeLessThan(2);
	expect(box.y).toBeGreaterThanOrEqual(area.y);

	await row(page, "package.json").click();
	await expect(summary).toHaveCount(0);
});

test("the panel is resizable, within limits, and stays where it was put", async ({
	page,
}) => {
	await page.goto(EXPRESS);
	await ready(page);
	const panel = page.getByTestId("tree-panel");
	const width = () =>
		panel.evaluate((node) => node.getBoundingClientRect().width);

	expect(await width()).toBe(320);

	const handle = page.getByRole("separator", { name: "Resize file tree" });
	const box = (await handle.boundingBox()) ?? {
		x: 0,
		y: 0,
		width: 0,
		height: 0,
	};
	// Above the middle: the middle of the edge is the collapse button's.
	const grip = { x: box.x + box.width / 2, y: box.y + box.height / 4 };
	await page.mouse.move(grip.x, grip.y);
	await page.mouse.down();
	await page.mouse.move(grip.x + 120, grip.y, { steps: 5 });
	await page.mouse.up();

	expect(await width()).toBe(440);
	await expect(handle).toHaveAttribute("aria-valuenow", "440");

	await page.reload();
	await ready(page);

	expect(await width()).toBe(440);
	// The width the panel is at, not the default the server rendered.
	await expect(handle).toHaveAttribute("aria-valuenow", "440");
});

test("a stored width is applied before the first paint", async ({ page }) => {
	await page.addInitScript((key) => {
		localStorage.setItem(key, "9999");
	}, TREE_WIDTH.key);
	await page.goto(EXPRESS);

	const applied = await page.evaluate(() =>
		document.documentElement.style.getPropertyValue("--tree-panel-width"),
	);

	// Clamped to leave room for the diff.
	expect(applied).toBe("640px");
});

test("the resizer answers the keyboard too", async ({ page }) => {
	await page.goto(EXPRESS);
	await ready(page);
	const handle = page.getByRole("separator", { name: "Resize file tree" });
	const panel = page.getByTestId("tree-panel");

	await handle.focus();
	await page.keyboard.press("ArrowRight");
	await page.keyboard.press("ArrowRight");

	expect(
		await panel.evaluate((node) => node.getBoundingClientRect().width),
	).toBe(352);
	await expect(handle).toHaveAttribute("aria-valuenow", "352");
});

test("the sidebar collapses from its edge, reopens from the header, and stays how it was left", async ({
	page,
}) => {
	await page.goto(EXPRESS);
	await ready(page);
	const panel = page.getByTestId("tree-panel");
	const expand = page.getByRole("button", { name: "Expand sidebar" });

	await expect(expand).toBeHidden();

	const collapse = page.getByRole("button", { name: "Collapse sidebar" });
	await expect(collapse).toHaveCSS("opacity", "0");
	await collapse.hover();
	await expect(collapse).toHaveCSS("opacity", "1");
	await collapse.click();

	await expect(panel).toBeHidden();
	await expect(expand).toBeVisible();

	await page.reload();
	await ready(page);
	await expect(panel).toBeHidden();

	await expand.click();
	await expect(panel).toBeVisible();
	await expect(expand).toBeHidden();
	expect(
		await page.evaluate((key) => localStorage.getItem(key), TREE_COLLAPSED.key),
	).toBe("false");
});

test("a collapsed sidebar is applied before the first paint", async ({
	page,
}) => {
	await page.addInitScript((key) => {
		localStorage.setItem(key, "true");
	}, TREE_COLLAPSED.key);
	await page.goto(EXPRESS);

	expect(
		await page.evaluate(() =>
			document.documentElement.hasAttribute("data-tree-collapsed"),
		),
	).toBe(true);
});

test("F finds: it opens a shut sidebar and lands in the filter", async ({
	page,
}) => {
	await page.addInitScript((key) => {
		localStorage.setItem(key, "true");
	}, TREE_COLLAPSED.key);
	await page.goto(EXPRESS);
	await ready(page);

	await page.locator("body").press("f");

	const filter = page.getByRole("searchbox", {
		name: "Filter files and folders",
	});
	await expect(filter).toBeFocused();
	await expect(page.getByTestId("tree-panel")).toBeVisible();

	// Inside the field, F is just typing.
	await page.keyboard.press("f");
	await expect(filter).toHaveValue("f");
});

test("dragged past its minimum the sidebar slides out, and let go there it snaps shut", async ({
	page,
}) => {
	await page.goto(EXPRESS);
	await ready(page);
	const panel = page.getByTestId("tree-panel");
	const content = panel.locator(":scope > div").first();
	const handle = page.getByRole("separator", { name: "Resize file tree" });
	const box = (await handle.boundingBox()) ?? {
		x: 0,
		y: 0,
		width: 0,
		height: 0,
	};
	const grip = { x: box.x + box.width / 2, y: box.y + box.height / 4 };

	await page.mouse.move(grip.x, grip.y);
	await page.mouse.down();
	await page.mouse.move(150, grip.y, { steps: 5 });

	// Held: the content keeps its 220px minimum and slides out, but nothing has shut.
	await expect(panel).toBeVisible();
	expect(
		await panel.evaluate((node) => node.getBoundingClientRect().width),
	).toBeLessThan(160);
	expect(
		await content.evaluate((node) => node.getBoundingClientRect().width),
	).toBe(220);
	expect(
		Number(await content.evaluate((node) => getComputedStyle(node).opacity)),
	).toBeLessThan(1);
	await expect(content).toHaveCSS("filter", /blur/);

	await page.mouse.up();
	await expect(panel).toBeHidden();

	await page.getByRole("button", { name: "Expand sidebar" }).click();
	// Back at its width before the drag, not the sliver it was left at.
	await expect(panel).toHaveCSS("width", "320px");
	await expect(content).toHaveCSS("opacity", "1");
	await expect(content).not.toHaveCSS("filter", /blur/);
});

test("let go the moment it starts to slide, the sidebar still snaps shut", async ({
	page,
}) => {
	await page.goto(EXPRESS);
	await ready(page);
	const panel = page.getByTestId("tree-panel");
	const handle = page.getByRole("separator", { name: "Resize file tree" });
	const box = (await handle.boundingBox()) ?? {
		x: 0,
		y: 0,
		width: 0,
		height: 0,
	};
	const grip = { x: box.x + box.width / 2, y: box.y + box.height / 4 };

	await page.mouse.move(grip.x, grip.y);
	await page.mouse.down();
	// Just past the 220px minimum, and still held: barely sliding, still open.
	await page.mouse.move(grip.x - 110, grip.y, { steps: 5 });
	await expect(panel).toBeVisible();

	await page.mouse.up();
	await expect(panel).toBeHidden();
});

test("let go at its minimum, the sidebar stays open at that width", async ({
	page,
}) => {
	await page.goto(EXPRESS);
	await ready(page);
	const panel = page.getByTestId("tree-panel");
	const handle = page.getByRole("separator", { name: "Resize file tree" });
	const box = (await handle.boundingBox()) ?? {
		x: 0,
		y: 0,
		width: 0,
		height: 0,
	};
	const grip = { x: box.x + box.width / 2, y: box.y + box.height / 4 };

	await page.mouse.move(grip.x, grip.y);
	await page.mouse.down();
	await page.mouse.move(grip.x - 100, grip.y, { steps: 5 });
	await page.mouse.up();

	await expect(panel).toBeVisible();
	await expect(panel).toHaveCSS("width", "220px");
});

async function boxOf(locator: Locator) {
	const box = await locator.boundingBox();
	if (!box) throw new Error("not on screen");

	return box;
}

async function openPosition(page: Page) {
	await openTreeOptions(page);
	await page.getByTestId("position-fold").click();
	await expect(option(page, "Right")).toBeVisible();
}

test("moved to the right, the whole sidebar mirrors, and it is there before the first paint", async ({
	page,
}) => {
	await page.goto(EXPRESS);
	await ready(page);
	const panel = page.getByTestId("tree-panel");
	const diff = page.getByTestId("diff-file");
	const width = () =>
		panel.evaluate((node) => node.getBoundingClientRect().width);
	await openPosition(page);
	await expect(page.getByTestId("position-fold")).toContainText("Left");

	await option(page, "Right").click();

	await expect(page.getByTestId("position-popup")).toBeHidden();
	await expect(page.getByTestId("position-fold")).toBeHidden();
	await expect(page.locator("html")).toHaveAttribute(
		"data-tree-position",
		"right",
	);
	await openTreeOptions(page);
	await expect(page.getByTestId("position-fold")).toContainText("Right");
	await page.keyboard.press("Escape");
	expect((await boxOf(panel)).x).toBeGreaterThanOrEqual(
		(await boxOf(diff)).x + (await boxOf(diff)).width,
	);

	await page.reload({ waitUntil: "domcontentloaded" });
	expect(
		await page.evaluate(() =>
			document.documentElement.getAttribute("data-tree-position"),
		),
	).toBe("right");
	await ready(page);
	const viewport = page.viewportSize() ?? { width: 0, height: 0 };
	expect(await boxOf(panel)).toMatchObject({ x: viewport.width - 320 });

	const handle = page.getByRole("separator", { name: "Resize file tree" });
	const edge = await boxOf(handle);
	expect(edge.x).toBeLessThan(viewport.width - 320);
	expect(edge.x + edge.width).toBeGreaterThan(viewport.width - 320);
	const grip = { x: edge.x + edge.width / 2, y: edge.y + edge.height / 4 };
	await page.mouse.move(grip.x, grip.y);
	await page.mouse.down();
	await page.mouse.move(grip.x - 120, grip.y, { steps: 5 });
	await page.mouse.up();
	expect(await width()).toBe(440);
	await handle.focus();
	await page.keyboard.press("ArrowLeft");
	expect(await width()).toBe(456);
	await expect(handle).toHaveAttribute("aria-valuenow", "456");

	const held = await boxOf(handle);
	await page.mouse.move(held.x + held.width / 2, grip.y);
	await page.mouse.down();
	await page.mouse.move(viewport.width - 100, grip.y, { steps: 5 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
		viewport.width,
	);
	await page.mouse.up();
	await expect(panel).toBeHidden();
	const expand = page.getByRole("button", { name: "Expand sidebar" });
	expect((await boxOf(expand)).x).toBeGreaterThan(viewport.width / 2);
	await expand.click();
	await expect(panel).toHaveCSS("width", "456px");

	const collapse = page.getByRole("button", { name: "Collapse sidebar" });
	await collapse.hover();
	await collapse.click();
	await expect(panel).toBeHidden();
	await expand.click();
	await expect(panel).toBeVisible();
	expect(await boxOf(panel)).toMatchObject({ x: viewport.width - 456 });

	await openPosition(page);
	const fold = await boxOf(page.getByTestId("position-fold"));
	const foldOut = await boxOf(page.getByTestId("position-popup"));
	expect(foldOut.x + foldOut.width).toBeLessThanOrEqual(fold.x);

	await option(page, "Left").click();

	await expect(page.locator("html")).not.toHaveAttribute("data-tree-position");
	expect(await boxOf(panel)).toMatchObject({ x: 0, width: 456 });
	expect((await boxOf(diff)).x).toBeGreaterThanOrEqual(456);
});
