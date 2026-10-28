import { expect, type Page, test } from "@playwright/test";
import { AUTOHIDE_SCROLLBAR } from "#/lib/storage/settings.ts";

// A few changes scattered through a 17 000-line file, almost none of them rendered.
const LODASH = "/npm/lodash/4.17.20/4.17.21/lodash.js";

const ENGINE = { timeout: 90_000 };

async function open(page: Page, path: string) {
	await page.goto(path);
	await expect(page.getByTestId("diff-view")).toBeVisible(ENGINE);
}

const scrollbar = (page: Page) => page.getByTestId("diff-scrollbar");
const thumb = (page: Page) => page.getByTestId("diff-scrollbar-thumb");
const scroller = (page: Page) => page.getByTestId("diff-scroller");

const scrollTop = (page: Page) =>
	scroller(page).evaluate((element) => element.scrollTop);

async function scrollTheFile(page: Page) {
	await scroller(page).hover();
	await page.mouse.wheel(0, 600);
	await expect.poll(() => scrollTop(page)).toBeGreaterThan(0);
}

test("keeps the scrollbar shown by default, while scrolling and after", async ({
	page,
}) => {
	await open(page, LODASH);
	await expect(scrollbar(page)).toHaveAttribute("data-shown", "true");

	await scrollTheFile(page);
	await page.waitForTimeout(1_000);

	await expect(scrollbar(page)).toHaveAttribute("data-shown", "true");
});

test("with auto-hide on, shows the scrollbar while the file is being scrolled, then hides it", async ({
	page,
}) => {
	await page.addInitScript(
		(key) => localStorage.setItem(key, "true"),
		AUTOHIDE_SCROLLBAR.key,
	);
	await open(page, LODASH);
	await expect(scrollbar(page)).toHaveAttribute("data-shown", "false");

	await scroller(page).hover();
	await page.mouse.wheel(0, 600);
	await expect(scrollbar(page)).toHaveAttribute("data-shown", "true");

	await expect(scrollbar(page)).toHaveAttribute("data-shown", "false");
});

test("the settings menu turns auto-hide on, and remembers it", async ({
	page,
}) => {
	await open(page, LODASH);

	await page.getByRole("button", { name: "Settings" }).click();
	await page.getByRole("button", { name: "Auto-hide scrollbar" }).click();
	await expect(scrollbar(page)).toHaveAttribute("data-shown", "false");

	await page.reload();
	await expect(page.getByTestId("diff-view")).toBeVisible(ENGINE);
	await expect(scrollbar(page)).toHaveAttribute("data-shown", "false");
});

test("scrolls the file by dragging the thumb", async ({ page }) => {
	await open(page, LODASH);

	const track = await scrollbar(page).boundingBox();
	const grip = await thumb(page).boundingBox();
	if (!track || !grip) throw new Error("no scrollbar");

	await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
	await page.mouse.down();
	await page.mouse.move(grip.x + grip.width / 2, track.y + track.height / 2);
	await page.mouse.up();

	expect(await scrollTop(page)).toBeGreaterThan(0);
	const dropped = await thumb(page).boundingBox();
	expect(dropped?.y ?? 0).toBeGreaterThan(track.y + track.height / 4);
});

async function clickNearTheTrackBottom(page: Page) {
	const track = await scrollbar(page).boundingBox();
	if (!track) throw new Error("no scrollbar");
	await page.mouse.click(track.x + track.width / 2, track.y + track.height - 8);
}

test("jumps to a part of the file clicked in the track", async ({ page }) => {
	await open(page, LODASH);

	await expect(async () => {
		await clickNearTheTrackBottom(page);
		expect(await scrollTop(page)).toBeGreaterThan(0);
	}).toPass();
});

test("marks every change in the file, not only the rendered ones", async ({
	page,
}) => {
	await open(page, LODASH);

	const markers = page.getByTestId("diff-marker");
	await expect(markers.first()).toBeAttached();

	// Only the top of the file is rendered, so markers taken from the DOM could not reach the bottom.
	const track = await scrollbar(page).boundingBox();
	const last = await markers.last().boundingBox();
	if (!track || !last) throw new Error("no markers");
	expect(last.y).toBeGreaterThan(track.y + track.height / 2);
});
