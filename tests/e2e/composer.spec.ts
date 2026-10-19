import { expect, type Page, test } from "@playwright/test";

const field = (page: Page) =>
	page.getByRole("combobox", { name: "Package Name" });
const from = (page: Page) =>
	page.getByRole("combobox", { name: "From Version" });

const option = (page: Page, name: string) =>
	page
		.getByRole("option")
		.filter({ has: page.getByText(name, { exact: true }) });

/** Playwright clicks as soon as an element exists; React may not own it yet. */
async function ready(page: Page) {
	await expect(page.locator("[data-ready]").first()).toBeAttached();
}

test("finds a Packagist package and opens it", async ({ page }) => {
	await page.goto("/composer");
	await ready(page);

	await field(page).fill("monolog");
	await option(page, "monolog/monolog").click();

	await expect(page).toHaveURL("/composer/monolog/monolog");
	await expect(page.getByTestId("workspace")).toHaveAttribute(
		"data-package",
		"monolog/monolog",
	);
});

test("lists the versions the proxy reads from Packagist", async ({ page }) => {
	await page.goto("/composer/monolog/monolog");
	await ready(page);
	await expect(from(page)).toBeEnabled();

	await from(page).click();

	await expect(page.getByRole("option", { name: "3.12.0" })).toBeVisible();
	await expect(page.getByRole("option", { name: "3.11.0" })).toBeVisible();
});

test("links each version to its Packagist page rather than offering a download", async ({
	page,
}) => {
	await page.goto("/composer/monolog/monolog/3.12.0/3.12.1");
	await ready(page);

	const link = page.getByRole("link", { name: "Packagist page for 3.12.0" });

	await expect(link).toHaveAttribute(
		"href",
		"https://packagist.org/packages/monolog/monolog#3.12.0",
	);
	await expect(link).toHaveAttribute("title", "Open on Packagist");
	await expect(page.getByRole("link", { name: /^Download/ })).toHaveCount(0);
});
