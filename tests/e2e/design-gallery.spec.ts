import { expect, type Page, test } from "@playwright/test";
import { THEME_SELECTION } from "#/lib/storage/settings.ts";

const SECTION_HEADINGS = ["Type", "Spacing", "Shape", "Colour", "Primitives"];

const UNRELATED_NOISE = /Failed to load resource|googletagmanager/;

function collectComplaints(page: Page): string[] {
	const complaints: string[] = [];
	page.on("console", (message) => {
		if (message.type() !== "error") return;
		if (UNRELATED_NOISE.test(message.text())) return;
		complaints.push(message.text());
	});
	page.on("pageerror", (error) => complaints.push(error.message));
	return complaints;
}

for (const theme of ["light", "dark"]) {
	test(`the design gallery renders every section in the ${theme} theme`, async ({
		page,
	}) => {
		await page.addInitScript(
			({ key, value }) => localStorage.setItem(key, value),
			{ key: THEME_SELECTION.key, value: theme },
		);
		const complaints = collectComplaints(page);

		const response = await page.goto("/design");

		expect(response?.status()).toBe(200);
		await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
		for (const name of SECTION_HEADINGS) {
			await expect(
				page.getByRole("heading", { level: 2, name, exact: true }),
			).toBeVisible();
		}
		await expect(page.getByRole("button", { name: /theme/i })).toBeEnabled();
		expect(complaints).toEqual([]);
	});
}

test("the gallery's menu opens on click", async ({ page }) => {
	await page.goto("/design");
	const trigger = page.getByRole("button", { name: "Jump to section" });
	await expect(page.getByRole("button", { name: /theme/i })).toBeEnabled();

	await trigger.click();

	await expect(page.getByRole("menuitem", { name: "Colour" })).toBeVisible();
});
