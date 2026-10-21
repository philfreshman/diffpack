import { expect, type Page, test } from "@playwright/test";

const ENGINE = { timeout: 90_000 };
const SWEEP_STEPS = 30;
const MOUSE_FRAME_MS = 16;

const trail = (page: Page) => page.getByTestId("ascii-trail");

async function openEmptyWorkspace(page: Page) {
	await page.goto("/npm");
	await expect(trail(page)).toBeVisible();
	await expect(page.locator("[data-ready]").first()).toBeAttached();
}

async function sweepAcross(page: Page, { holding = false } = {}) {
	const box = await trail(page).boundingBox();
	if (!box) throw new Error("the trail canvas has no box");
	const row = box.y + box.height / 2;
	const start = box.x + box.width * 0.2;
	const travel = box.width * 0.6;
	await page.mouse.move(start, row);
	if (holding) await page.mouse.down();
	for (let step = 1; step <= SWEEP_STEPS; step += 1) {
		await page.mouse.move(start + (travel * step) / SWEEP_STEPS, row);
		await page.waitForTimeout(MOUSE_FRAME_MS);
	}
}

async function litAfterSweep(page: Page, holding: boolean): Promise<number> {
	await openEmptyWorkspace(page);
	await sweepAcross(page, { holding });
	await page.waitForTimeout(200);
	const lit = await litPixels(page);
	if (holding) await page.mouse.up();
	return lit;
}

function litPixels(page: Page): Promise<number> {
	return trail(page).evaluate((canvas: HTMLCanvasElement) => {
		const context = canvas.getContext("2d");
		if (!context) return 0;
		const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
		let lit = 0;
		for (let alpha = 3; alpha < data.length; alpha += 4) {
			if (data[alpha]) lit += 1;
		}
		return lit;
	});
}

test("stirs characters into the empty workspace behind the pointer", async ({
	page,
}) => {
	await openEmptyWorkspace(page);

	await sweepAcross(page);

	await expect.poll(() => litPixels(page)).toBeGreaterThan(0);
});

test("stirs a wider trail while the pointer drags", async ({ page }) => {
	const hovered = await litAfterSweep(page, false);
	const dragged = await litAfterSweep(page, true);

	expect(dragged).toBeGreaterThan(hovered * 1.3);
});

test("leaves the empty workspace still on a click", async ({ page }) => {
	await openEmptyWorkspace(page);
	const box = await trail(page).boundingBox();
	if (!box) throw new Error("the trail canvas has no box");

	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	await page.waitForTimeout(300);

	expect(await litPixels(page)).toBe(0);
});

test("keeps the empty workspace still for reduced motion", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await openEmptyWorkspace(page);

	await sweepAcross(page);
	await page.waitForTimeout(300);

	expect(await litPixels(page)).toBe(0);
});

test("gives way once the URL names a comparison", async ({ page }) => {
	await page.goto("/npm/node/26.6.0/26.7.0");
	await expect(page.getByTestId("workspace")).toHaveAttribute(
		"data-state",
		"ready",
		ENGINE,
	);

	await expect(trail(page)).toHaveCount(0);
});
