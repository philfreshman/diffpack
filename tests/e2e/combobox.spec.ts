import { expect, type Page, test } from "@playwright/test";

// Through both call sites: version selectors filter locally, package search arrives filtered.
const VERSIONS = {
	versions: {
		"4.16.0": {},
		"4.17.3": {},
		"4.18.2": {},
		"5.0.1": {},
		"5.1.0": {},
	},
};
/** Newest first, as the adapter hands them over. */
const NEWEST_FIRST = ["5.1.0", "5.0.1", "4.18.2", "4.17.3", "4.16.0"];

const RESULTS = [
	{
		package: {
			name: "express",
			version: "5.1.0",
			description: "Fast, unopinionated web framework",
		},
	},
	{ package: { name: "expressive", version: "1.0.0", description: "" } },
];

const input = (page: Page) =>
	page.getByRole("combobox", { name: "From Version" });
// Scoped to the listbox: the toolbar's theme picker has options of its own on screen.
const options = (page: Page) => page.getByRole("listbox").getByRole("option");

async function highlighted(page: Page): Promise<string | null> {
	const id = await input(page).getAttribute("aria-activedescendant");
	return id ? page.locator(`#${id}`).textContent() : null;
}

async function stubVersions(page: Page, delayMs = 0) {
	await page.route("https://registry.npmjs.org/express", async (route) => {
		if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
		await route.fulfill({ json: VERSIONS });
	});
}

// Playwright acts as soon as an element is actionable, which can be before React hydrates it.
async function hydrated(page: Page) {
	await expect(page.locator("[data-ready]").first()).toBeAttached();
}

async function ready(page: Page) {
	await hydrated(page);
	await expect(input(page)).toBeEnabled();
}

// Waits for the list, so a key press cannot outrun it.
async function open(page: Page) {
	await ready(page);
	await input(page).click();
	await expect(options(page)).toHaveCount(NEWEST_FIRST.length);
}

test("filters the list to what was typed", async ({ page }) => {
	await stubVersions(page);
	await page.goto("/npm/express");
	await open(page);

	await input(page).fill("5.");

	await expect(options(page)).toHaveText(["5.1.0", "5.0.1"]);
});

test("moves the highlight with the arrow keys, wrapping at both ends", async ({
	page,
}) => {
	await stubVersions(page);
	await page.goto("/npm/express");
	await open(page);

	await input(page).press("ArrowDown");
	expect(await highlighted(page)).toBe("5.1.0");

	// Per the ARIA practices guide the input is part of the loop, between the last row and the first.
	for (let i = 0; i < 4; i += 1) await input(page).press("ArrowDown");
	expect(await highlighted(page)).toBe("4.16.0");

	await input(page).press("ArrowDown");
	expect(await highlighted(page)).toBe(null);

	await input(page).press("ArrowUp");
	expect(await highlighted(page)).toBe("4.16.0");
});

test("Enter takes the highlighted row", async ({ page }) => {
	await stubVersions(page);
	await page.goto("/npm/express");
	await open(page);

	await input(page).press("ArrowDown");
	await input(page).press("ArrowDown");
	await input(page).press("ArrowDown");
	await input(page).press("Enter");

	await expect(input(page)).toHaveValue("4.18.2");
	await expect(options(page)).toHaveCount(0);
});

test("Enter with nothing highlighted does nothing where there is no such thing", async ({
	page,
}) => {
	// Version selectors leave `onSubmitText` out; only package search takes raw text on Enter.
	await stubVersions(page);
	await page.goto("/npm/express");
	await open(page);

	await input(page).fill("6.0.0-rc.1");
	await input(page).press("Enter");

	await expect(page).toHaveURL("/npm/express");
	await expect(input(page)).toHaveValue("5.0.1");
});

test("Escape closes the list and keeps the text", async ({ page }) => {
	// Package search, since a version field puts its chosen version back on close.
	await page.route("https://registry.npmjs.org/-/v1/search**", (route) =>
		route.fulfill({ json: { objects: RESULTS } }),
	);
	await page.goto("/npm");
	await hydrated(page);
	const search = page.getByRole("combobox", { name: "Package Name" });
	await search.fill("expr");
	await expect(options(page).first()).toBeVisible();

	await search.press("Escape");

	await expect(options(page)).toHaveCount(0);
	await expect(search).toHaveValue("expr");
});

test("a click on a row lands, rather than being eaten by the blur", async ({
	page,
}) => {
	await stubVersions(page);
	await page.goto("/npm/express");
	await open(page);

	await options(page).nth(2).click();

	await expect(input(page)).toHaveValue("4.18.2");
	await expect(options(page)).toHaveCount(0);
});

test("says so when nothing matches, instead of showing an empty box", async ({
	page,
}) => {
	await stubVersions(page);
	await page.goto("/npm/express");
	await open(page);

	await input(page).fill("nothing like this");

	await expect(options(page)).toHaveCount(0);
	await expect(page.getByText("No matching versions")).toBeVisible();
});

test("says the list is on its way while the caller fetches it", async ({
	page,
}) => {
	// Held open, or the in-flight state could not be observed.
	await stubVersions(page, 5_000);
	await page.goto("/npm/express");
	await hydrated(page);

	await input(page).click();

	await expect(page.getByRole("status")).toHaveText("Loading versions…");
	await expect(options(page)).toHaveCount(0);
});

test("announces itself as a combobox over a listbox", async ({ page }) => {
	await stubVersions(page);
	await page.goto("/npm/express");
	await ready(page);

	await expect(input(page)).toHaveAttribute("aria-expanded", "false");

	await input(page).click();

	await expect(input(page)).toHaveAttribute("aria-expanded", "true");
	await expect(page.getByRole("listbox")).toBeVisible();
	await expect(options(page).first()).toHaveAttribute("aria-selected", "false");
});

test("closes when focus leaves the field", async ({ page }) => {
	await stubVersions(page);
	await page.goto("/npm/express");
	await open(page);

	// Tab, not an outside click: while the list is open Base UI makes the rest of the document inert.
	await input(page).press("Tab");

	await expect(options(page)).toHaveCount(0);
});

test("leaves the list alone when the caller has already filtered it", async ({
	page,
}) => {
	await page.route("https://registry.npmjs.org/-/v1/search**", (route) =>
		route.fulfill({ json: { objects: RESULTS } }),
	);
	await page.goto("/npm");
	await hydrated(page);
	const search = page.getByRole("combobox", { name: "Package Name" });

	await search.fill("web framework");

	// Neither name contains the query, so a local filter would drop both.
	await expect(options(page)).toHaveText([/express/, /expressive/]);
});
