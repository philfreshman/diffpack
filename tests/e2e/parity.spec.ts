import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import {
	HIGHLIGHT_THEME,
	ONLY_MODIFIED,
	SPLIT_VIEW,
	searchHistory,
	THEME_SELECTION,
	TREE_WIDTH,
} from "#/lib/storage/settings.ts";

const ENGINE = { timeout: 90_000 };

const status = (page: Page) => page.getByTestId("workspace");
const files = (page: Page) =>
	page.getByRole("treeitem").and(page.locator("[data-type='file']"));

async function ready(page: Page, path: string) {
	await page.goto(path);
	await expect(status(page)).toHaveAttribute("data-state", "ready", ENGINE);
}

// Each registry's archive extracts differently (Go's versioned root, PyPI's sdist, crates' tarball).
const MATRIX = [
	{
		name: "crates.io",
		path: "/crates/serde/1.0.228/1.0.229",
		file: "Cargo.toml",
	},
	{
		name: "PyPI",
		path: "/pypi/requests/2.34.1/2.34.2",
		file: "PKG-INFO",
	},
	{
		name: "Go",
		path: "/go/github.com/go-chi/chi/v5/v5.3.1/v5.3.2",
		file: "tree.go",
	},
	{
		name: "Packagist",
		path: "/composer/monolog/monolog/3.12.0/3.12.1",
		file: "Logger.php",
	},
	{
		name: "a scoped npm package",
		path: "/npm/@types/node/26.3.0/26.4.0",
		file: "package.json",
	},
];

for (const { name, path, file } of MATRIX) {
	test(`compares a package from ${name}`, async ({ page }) => {
		await ready(page, path);

		await expect(files(page).first()).toBeVisible();
		await files(page).filter({ hasText: file }).first().click();

		await expect(page).toHaveURL(new RegExp(`/${file.replace(".", "\\.")}$`));
		await expect(page.getByTestId("diff-view")).toBeVisible(ENGINE);
	});
}

test("counts the whole comparison, and how much of it changed", async ({
	page,
}) => {
	// Three files, two changed: the tree shows only the two, so "3 files" alone reads as a miscount.
	await ready(page, "/npm/node/26.6.0/26.7.0");

	await expect(page.getByTestId("summary-files")).toHaveText(
		"3 files, 2 changed",
	);
	await expect(files(page)).toHaveCount(2);
});

test("no file in a Go module reads as its versioned root", async ({ page }) => {
	await ready(page, "/go/github.com/go-chi/chi/v5/v5.3.1/v5.3.2");

	const paths = await files(page).evaluateAll((rows) =>
		rows.map((row) => row.getAttribute("data-path") ?? ""),
	);

	expect(paths.length).toBeGreaterThan(0);
	expect(paths.some((p) => p.includes("@v5."))).toBe(false);
	expect(paths).toContain("tree.go");
	expect(paths).toContain("middleware/compress.go");
});

const STORED = {
	[THEME_SELECTION.key]: "light",
	[SPLIT_VIEW.key]: "true",
	[HIGHLIGHT_THEME.key]: "nightfall",
	[TREE_WIDTH.key]: "320",
	[ONLY_MODIFIED.key]: "false",
	[searchHistory("npm").key]: JSON.stringify([{ name: "express" }]),
};

// The old site's key names and value formats: changing either drops returning visitors' settings.
test("writes the same six localStorage keys as the old site", async ({
	page,
}) => {
	// Literal names, so a renamed constant fails here instead of carrying every other spec along.
	expect(Object.keys(STORED).sort()).toEqual([
		"highlight_theme",
		"search_history_npm",
		"split-view-preference",
		"theme",
		"tree_panel_width",
		"tree_show_only_modified",
	]);

	await page.addInitScript((entries) => {
		for (const [key, value] of entries) localStorage.setItem(key, value);
	}, Object.entries(STORED));
	await ready(page, "/npm/node/26.6.0/26.7.0");

	const stored = await page.evaluate(() => ({ ...localStorage }));

	expect(Object.keys(stored).sort()).toEqual(Object.keys(STORED).sort());
	for (const [key, value] of Object.entries(STORED)) {
		expect(stored[key]).toBe(value);
	}

	await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
	await expect(page.getByTestId("tree-panel")).toHaveCSS("width", "320px");
});

test("serves every icon and card image it points at", async ({
	page,
	request,
}) => {
	await page.goto("/");

	const referenced = await page.evaluate(() => ({
		icons: [...document.querySelectorAll<HTMLLinkElement>("link[rel*='icon']")]
			.map((link) => link.getAttribute("href") ?? "")
			.concat(
				document
					.querySelector<HTMLLinkElement>("link[rel='manifest']")
					?.getAttribute("href") ?? "",
			),
		cards: [
			...document.querySelectorAll<HTMLMetaElement>("meta[property$=':image']"),
		].map((meta) => meta.content),
	}));

	expect(referenced.icons).toEqual([
		"/favicon-96x96.png",
		"/favicon.svg",
		"/favicon.ico",
		"/apple-touch-icon.png",
		"/site.webmanifest",
	]);
	expect(referenced.cards).toEqual([
		"https://diffpack.io/web-app-manifest-512x512.png",
		"https://diffpack.io/web-app-manifest-512x512.png",
	]);

	const cardPaths = referenced.cards.map((card) => new URL(card).pathname);
	for (const href of [...referenced.icons, ...cardPaths]) {
		const response = await request.get(href);
		expect(response.status(), href).toBe(200);
	}

	// The manifest a returning visitor's installed shortcut resolves against.
	const manifest = await (await request.get("/site.webmanifest")).json();
	expect(manifest).toEqual(
		JSON.parse(readFileSync("public/site.webmanifest", "utf8")),
	);
});

test("counts a visit, and each comparison after it", async ({ page }) => {
	// Stubbed so no traffic from a test run reaches the analytics property.
	await page.route("https://www.googletagmanager.com/**", (route) =>
		route.fulfill({ status: 204, body: "" }),
	);
	await page.goto("/npm");
	await expect(page.getByTestId("workspace")).toBeVisible();
	// Visible is not hydrated: before `data-ready`, a link click is a full page load.
	await expect(page.locator("[data-ready]").first()).toBeAttached();

	const dataLayer = () =>
		page.evaluate(() =>
			[...(window.dataLayer ?? [])].map((entry) => [...entry]),
		);

	expect(await dataLayer()).toEqual([
		["js", expect.anything()],
		["config", "G-JH9PM7WWGG"],
	]);

	// Each client-side navigation counts as a page view, as each URL did on the old Astro site.
	// The hover preloads the route chunk (`defaultPreload: "intent"`); a click before it lands hard-navigates.
	await page.getByRole("button", { name: /Switch registry/ }).click();
	const home = page.getByRole("menuitem", { name: "All registries" });
	await home.hover();
	await page.waitForLoadState("networkidle");

	// A hard navigation resets `dataLayer`, which looks like an uncounted view; the stamp tells them apart.
	await page.evaluate(() => {
		(window as Window & { __document?: true }).__document = true;
	});

	await home.click();
	await expect(page).toHaveURL("/");

	expect(
		await page.evaluate(
			() => (window as Window & { __document?: true }).__document ?? false,
		),
		"the click should have been a client-side navigation, not a page load",
	).toBe(true);

	// The view is reported once the head reconciles, about a second after the click.
	await expect
		.poll(async () => (await dataLayer()).length, { timeout: 15_000 })
		.toBeGreaterThan(2);
	const [type, name, params] = (await dataLayer())[2] as [
		string,
		string,
		Record<string, string>,
	];
	expect([type, name]).toEqual(["event", "page_view"]);
	expect(params.page_path).toBe("/");
	// The title of the page arrived at, not the one just left.
	expect(params.page_title).toBe(
		"diffpack: compare npm, crates.io, Go, PyPI and Packagist versions",
	);
});

// A hydration mismatch only shows as a console error; the pre-paint `<head>` scripts are the usual cause.
const ROUTES = [
	"/",
	"/npm",
	"/crates",
	"/pypi",
	"/go",
	"/composer",
	"/npm/express/4.18.2/5.1.0",
	"/composer/monolog/monolog/3.12.0/3.12.1/src/Monolog/Logger.php",
	"/go/github.com/go-chi/chi/v5/v5.3.1/v5.3.2/tree.go",
];

for (const route of ROUTES) {
	test(`renders ${route} without complaining to the console`, async ({
		page,
	}) => {
		const complaints: string[] = [];
		page.on("console", (message) => {
			if (message.type() !== "error" && message.type() !== "warning") return;
			const text = message.text();
			// Ignored: registry 404s, headless Chromium's GL chatter, and the wasm MIME warning from
			// `vite preview`, which skips the `nitro({ routeRules })` headers the deploy serves.
			if (
				/Failed to load resource|googletagmanager|WebGL-0x|GL Driver Message|instantiateStreaming/.test(
					text,
				)
			) {
				return;
			}
			complaints.push(text);
		});
		page.on("pageerror", (error) => complaints.push(error.message));

		await page.goto(route);
		await expect(page.locator("html")).toHaveAttribute("data-theme", /.+/);
		// Long enough for hydration to report a mismatch.
		await page.waitForTimeout(2_000);

		expect(complaints).toEqual([]);
	});
}
