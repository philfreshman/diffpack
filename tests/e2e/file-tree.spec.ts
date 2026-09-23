import { gzipSync } from "node:zlib";
import { expect, type Page, test } from "@playwright/test";
import {
	ONLY_MODIFIED,
	TREE_COLLAPSED,
	TREE_WIDTH,
} from "#/lib/storage/settings.ts";

/**
 * express 4.18.2 → 5.1.0: a real, nested, thoroughly changed comparison, which
 * is what the tree exists for. It comes from the real registry — the engine
 * only runs in a worker, so there is nothing to stub.
 */
const EXPRESS = "/npm/express/4.18.2/5.1.0";

/** Downloading and extracting two archives is not a 10 s assertion. */
const ENGINE = { timeout: 90_000 };

const tree = (page: Page) => page.getByRole("tree");
const row = (page: Page, name: string | RegExp) =>
	page.getByRole("treeitem").filter({ hasText: name });

async function ready(page: Page) {
	await expect(page.getByTestId("diff-status")).toHaveAttribute(
		"data-state",
		"ready",
		ENGINE,
	);
}

/**
 * A package made up for a tree that is one folder deep, which no real registry
 * serves: every npm, crates.io and PyPI archive keeps its manifest at the root,
 * beside whatever folders it has. Its version list and its tarballs are
 * answered from here, and the engine unpacks them like any others.
 */
const MADE_UP = "diffpack-made-up";

const MADE_UP_FILES: Record<string, Record<string, string>> = {
	"0.9.0": { "README.md": "one\n", "lib/index.js": "let one;\n" },
	// Loose at the root, beside a folder there is to open by hand, and changed
	// from 0.9.0 in nothing but whitespace.
	"1.0.0": { "README.md": "one\n", "lib/index.js": "let  one;\n" },
	// Everything under `src/`, and nothing beside it.
	"2.0.0": { "src/index.js": "two\n" },
	"3.0.0": { "src/index.js": "three\n" },
};

async function serveMadeUpPackage(page: Page) {
	const registry = `https://registry.npmjs.org/${MADE_UP}`;
	const versions = Object.fromEntries(
		Object.keys(MADE_UP_FILES).map((version) => [version, {}]),
	);
	await page.route(registry, (route) => route.fulfill({ json: { versions } }));
	// The engine fetches from its worker, and a worker's requests are routed
	// like the page's.
	await page.route(`${registry}/-/*`, (route) => {
		const version = /-([\d.]+)\.tgz$/.exec(route.request().url())?.[1] ?? "";
		const files = MADE_UP_FILES[version];
		return files ? route.fulfill({ body: tarball(files) }) : route.abort();
	});
}

/**
 * `files` packed the way npm packs a package: each under `package/`, which the
 * engine strips. A tar is a 512-byte header per file, the file padded out to
 * whole blocks, and two empty blocks to end on.
 */
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
	// The checksum is the sum of the header's bytes, its own field counted as
	// eight spaces.
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

test("says what changed in each file, and how much", async ({ page }) => {
	await page.goto(EXPRESS);
	await ready(page);

	const manifest = row(page, "package.json");
	// The counts are the engine's, so the assertion is on their shape rather
	// than on numbers npm could republish.
	await expect(manifest.getByTestId("added")).toHaveText(/^\+\d+$/);
	await expect(manifest.getByTestId("removed")).toHaveText(/^-\d+$/);

	// A folder answers for everything under it, or a collapsed folder would say
	// nothing changed inside it.
	await expect(row(page, "lib").first().getByTestId("removed")).toHaveText(
		/^-\d+$/,
	);
});

test("opens on what changed, without the untouched files", async ({ page }) => {
	await page.goto(EXPRESS);
	await ready(page);

	// only-modified is on for a first-time visitor, and the folders leading to
	// what changed open themselves — so a nested file is one look away, not
	// three clicks.
	await expect(row(page, "query.js")).toBeVisible();
	await expect(row(page, "query.js")).toHaveAttribute("data-status", "removed");
	await expect(
		page.locator("[role='treeitem'][data-status='unchanged']"),
	).toHaveCount(0);
});

test("colours a file by what happened to it", async ({ page }) => {
	await page.goto(EXPRESS);
	await ready(page);

	const removed = await row(page, "query.js")
		.getByTestId("name")
		.evaluate((node) => getComputedStyle(node).color);
	const modified = await row(page, "package.json")
		.getByTestId("name")
		.evaluate((node) => getComputedStyle(node).color);

	expect(removed).toBe("rgb(248, 113, 113)");
	expect(modified).toBe("rgb(251, 191, 36)");
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

test("the toggle brings the unchanged files back, and remembers it", async ({
	page,
}) => {
	await page.goto(EXPRESS);
	await ready(page);
	const toggle = page.getByRole("button", { name: "Show only modified files" });
	await expect(toggle).toHaveAttribute("aria-pressed", "true");

	await toggle.click();

	await expect(toggle).toHaveAttribute("aria-pressed", "false");
	await expect(
		page.locator("[role='treeitem'][data-status='unchanged']").first(),
	).toBeVisible();

	await page.reload();
	await ready(page);

	await expect(
		page.getByRole("button", { name: "Show only modified files" }),
	).toHaveAttribute("aria-pressed", "false");
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
	// Showing everything: with only-modified on, every folder with a change in
	// it opens itself, and `src` would open whatever had carried over.
	await page.addInitScript((key) => {
		localStorage.setItem(key, "false");
	}, ONLY_MODIFIED.key);
	await page.goto(`/npm/${MADE_UP}/1.0.0/3.0.0`);
	await ready(page);
	const lib = row(page, "lib");
	await expect(lib).toHaveAttribute("aria-expanded", "false");

	await lib.click();
	await expect(lib).toHaveAttribute("aria-expanded", "true");

	// Other versions, chosen in the page rather than by loading another: a new
	// page forgets every folder anyway, so only this way can one carry over.
	const from = page.getByRole("combobox", { name: "From Version" });
	await from.fill("2.0.0");
	await page.getByRole("option", { name: "2.0.0", exact: true }).click();
	await page.getByRole("button", { name: "Compare" }).click();
	await expect(page).toHaveURL(`/npm/${MADE_UP}/2.0.0/3.0.0`);

	// `lib` was opened in a comparison that had it. This one is all `src`, and
	// a tree that is one folder deep opens that folder, but only while no
	// folder has been chosen by hand.
	await expect(row(page, "index.js")).toBeVisible();
	await expect(row(page, "src")).toHaveAttribute("aria-expanded", "true");
	await expect(lib).toHaveCount(0);
});

test("the same comparison keeps its folders, with another file open or whitespace ignored", async ({
	page,
}) => {
	await serveMadeUpPackage(page);
	// Showing everything, so the file is still there once it counts as
	// unchanged.
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
	await expect(lib).toHaveAttribute("aria-expanded", "true");

	// The tree is built again, and the file that changed only in whitespace
	// comes back unchanged: the same two versions, asked another way.
	await page.getByRole("button", { name: "Settings" }).click();
	await page.getByRole("button", { name: "Ignore whitespaces" }).click();
	await expect(index).toHaveAttribute("data-status", "unchanged", ENGINE);
	await expect(lib).toHaveAttribute("aria-expanded", "true");
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
	// A file has nothing to open, so it has no chevron at all.
	await expect(row(page, "package.json").getByTestId("chevron")).toHaveCount(0);
	await expect(row(page, "package.json").getByTestId("icon")).toHaveAttribute(
		"data-icon",
		"file",
	);
});

test("the tree is one tab stop, and the arrows move inside it", async ({
	page,
}) => {
	await page.goto(EXPRESS);
	await ready(page);
	const rows = page.getByRole("treeitem");

	// Roving tabindex: whatever the tree's row count, Tab reaches the tree once.
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

	// Left closes an open folder; a second left goes up to its parent.
	await expect(middleware).toHaveAttribute("aria-expanded", "false");
	await page.keyboard.press("ArrowLeft");
	await expect(row(page, "lib").first()).toBeFocused();

	await page.keyboard.press("ArrowRight");
	await page.keyboard.press("ArrowRight");

	// Right on an open folder steps into it rather than doing nothing.
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

test("counts the comparison at the foot of the panel it describes", async ({
	page,
}) => {
	await page.goto(EXPRESS);
	await ready(page);

	// The count is about the tree, so it stands under the tree rather than over
	// the whole body.
	const panel = page.getByTestId("tree-panel");
	const status = panel.getByTestId("diff-status");
	await expect(status).toHaveText(/^\d+ files, \d+ changed$/);

	const rows = (await tree(page).boundingBox()) ?? { y: 0, height: 0 };
	const foot = (await status.boundingBox()) ?? { y: 0, height: 0 };
	expect(foot.y).toBeGreaterThanOrEqual(rows.y + rows.height);
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
	// The handle announces the width the panel is at, not the default the
	// server rendered it with.
	await expect(handle).toHaveAttribute("aria-valuenow", "440");
});

test("a stored width is applied before the first paint", async ({ page }) => {
	// Applied by the pre-paint script, like the theme: a panel that starts at
	// its default and jumps once React hydrates is a visible flash.
	await page.addInitScript((key) => {
		localStorage.setItem(key, "9999");
	}, TREE_WIDTH.key);
	await page.goto(EXPRESS);

	const applied = await page.evaluate(() =>
		document.documentElement.style.getPropertyValue("--tree-panel-width"),
	);

	// Clamped, too: a stored width has to leave room for the diff.
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
	// A slider-like control has to say where it is, not just look draggable.
	await expect(handle).toHaveAttribute("aria-valuenow", "352");
});

test("the sidebar collapses from its edge, reopens from the header, and stays how it was left", async ({
	page,
}) => {
	await page.goto(EXPRESS);
	await ready(page);
	const panel = page.getByTestId("tree-panel");
	const expand = page.getByRole("button", { name: "Expand sidebar" });

	// The way back in only exists while there is somewhere to go back to.
	await expect(expand).toBeHidden();

	// Out of sight until the edge is reached for, like a dashboard's.
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

	// Typing it is not asking for it: the F went into the field.
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

	// Held: the box follows the pointer, and what is in it holds the minimum
	// and slides out, fading and blurring — but nothing has shut.
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
	// Back at the width it had before the drag, not the sliver it was left at.
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
