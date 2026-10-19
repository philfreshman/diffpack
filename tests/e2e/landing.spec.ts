import { expect, test } from "@playwright/test";
import { THEME_SELECTION } from "#/lib/storage/settings.ts";

test("offers every registry diffpack supports", async ({ page }) => {
	await page.goto("/");

	const tiles = page.getByTestId("registry-tile");

	await expect(tiles).toHaveCount(5);
	await expect(tiles).toHaveText([
		/npm/,
		/crates\.io/,
		/Go/,
		/PyPI/,
		/Packagist/,
	]);
});

test("says what each registry is for, and offers it as one link", async ({
	page,
}) => {
	await page.goto("/");

	const npm = page.getByRole("link", { name: /npm/ });

	await expect(npm).toHaveAttribute("href", "/npm");
	await expect(npm).toContainText("JavaScript & TypeScript packages");
});

test("opens a registry from its tile", async ({ page }) => {
	await page.goto("/");

	await page
		.getByTestId("registry-tile")
		.filter({ hasText: "crates.io" })
		.click();

	await expect(page).toHaveURL(/\/crates$/);
	await expect(page).toHaveTitle(
		"Compare crates.io package versions | diffpack",
	);
});

test("gives the Packagist tile PHP's purple, not the default accent", async ({
	page,
}) => {
	await page.goto("/");

	const accent = await page
		.getByTestId("registry-tile")
		.filter({ hasText: "Packagist" })
		.evaluate((node) =>
			getComputedStyle(node).getPropertyValue("--tile-accent").trim(),
		);

	expect(accent).toBe("119 123 180");
});

test("names every registry in the keywords search engines read", async ({
	request,
}) => {
	const html = await (await request.get("/npm")).text();

	for (const keyword of ["go", "packagist", "composer", "php"]) {
		expect(html).toMatch(
			new RegExp(`name="keywords" content="[^"]*\\b${keyword}\\b`),
		);
	}
});

test("glows on hover without a single inline handler", async ({ page }) => {
	await page.goto("/");

	const tile = page.getByTestId("registry-tile").first();
	const shadow = () =>
		tile.evaluate((node) => getComputedStyle(node).boxShadow);

	expect(await shadow()).toBe("none");

	await tile.hover();

	await expect.poll(shadow).toContain("rgb");
	expect(
		await page.locator("[onmouseover], [onmouseout], [onclick]").count(),
	).toBe(0);
});

test("points at the repository from the footer", async ({ page }) => {
	await page.goto("/");

	const repo = page.getByRole("link", { name: "diffpack on GitHub" });

	await expect(repo).toHaveAttribute(
		"href",
		"https://github.com/philfreshman/diffpack",
	);
	await expect(repo).toHaveAttribute("rel", "noopener noreferrer");
});

test("describes itself for anything that links to it", async ({ request }) => {
	const html = await (await request.get("/")).text();

	expect(html).toContain("<title>diffpack</title>");
	expect(html).toContain(
		'content="Compare package versions across ecosystems. Source-aware dependency review for npm, crates.io, Go, PyPI and Packagist."',
	);
});

test("shares the site-wide description, naming every registry", async ({
	request,
}) => {
	const html = await (await request.get("/")).text();
	const shared =
		"Compare package versions across ecosystems. Clean. Fast. Source-aware dependency review tool for npm, crates.io, Go, PyPI and Packagist.";

	expect(html).toContain(`property="og:description" content="${shared}"`);
	expect(html).toContain(`property="twitter:description" content="${shared}"`);
});

test("hangs the nebula behind the stars, in the dark theme only", async ({
	page,
}) => {
	await page.goto("/");

	const backdrop = () =>
		page
			.getByTestId("cosmos")
			.evaluate((node) => getComputedStyle(node).backgroundImage);

	expect(await backdrop()).toContain("radial-gradient");

	await page.evaluate(
		(key) => localStorage.setItem(key, "light"),
		THEME_SELECTION.key,
	);
	await page.reload();

	expect(await backdrop()).toBe("none");
});

test("holds the nebula still when the visitor asks for reduced motion", async ({
	browser,
}) => {
	const page = await browser.newPage({ reducedMotion: "reduce" });
	await page.goto("/");

	const animation = await page
		.getByTestId("cosmos")
		.evaluate((node) => getComputedStyle(node).animationName);

	expect(animation).toBe("none");
	await page.close();
});
