import { expect, type Page, test } from "@playwright/test";

const field = (page: Page) =>
	page.getByRole("combobox", { name: "Package Name" });
const from = (page: Page) =>
	page.getByRole("combobox", { name: "From Version" });

const option = (page: Page, name: string) =>
	page
		.getByRole("option")
		.filter({ has: page.getByText(name, { exact: true }) });

async function untilHydrated(page: Page) {
	await expect(page.locator("[data-ready]").first()).toBeAttached();
}

test("finds a Packagist package and opens it", async ({ page }) => {
	await page.goto("/composer");
	await untilHydrated(page);

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
	await untilHydrated(page);
	await expect(from(page)).toBeEnabled();

	await from(page).click();

	await expect(page.getByRole("option", { name: "3.12.0" })).toBeVisible();
	await expect(page.getByRole("option", { name: "3.11.0" })).toBeVisible();
});

test("links each version to its Packagist page rather than offering a download", async ({
	page,
}) => {
	await page.goto("/composer/monolog/monolog/3.12.0/3.12.1");
	await untilHydrated(page);

	const link = page.getByRole("link", { name: "Packagist page for 3.12.0" });

	await expect(link).toHaveAttribute(
		"href",
		"https://packagist.org/packages/monolog/monolog#3.12.0",
	);
	await expect(link).toHaveAttribute("title", "Open on Packagist");
	await expect(link).toHaveAttribute("data-opens", "page");
	await expect(page.getByRole("link", { name: /^Download/ })).toHaveCount(0);
});

const MONOLOG = "/composer/monolog/monolog/3.12.0/3.12.1";
const PROXY = "https://diffpack-proxy.philipswiezak.workers.dev";
const ENGINE = { timeout: 90_000 };
const RESETS_AT = "2026-10-20T05:30:00Z";

const status = (page: Page) => page.getByTestId("diff-status");
const notice = (page: Page) => page.getByTestId("proxy-limit-notice");
const treeRow = (page: Page, name: string) =>
	page
		.getByTestId("tree-panel")
		.getByRole("treeitem")
		.filter({ has: page.getByTestId("name").getByText(name, { exact: true }) });

async function recordBuildRequests(page: Page) {
	await page.addInitScript(() => {
		const posted: unknown[] = [];
		(window as unknown as Record<string, unknown>).__posted = posted;
		const original = Worker.prototype.postMessage;
		Worker.prototype.postMessage = function patched(
			this: Worker,
			...args: [message: unknown, ...rest: unknown[]]
		) {
			posted.push(args[0]);
			return (original as (...args: unknown[]) => void).apply(this, args);
		};
	});

	return () =>
		page.evaluate(() =>
			(
				((window as unknown as Record<string, unknown>).__posted as {
					type?: string;
				}[]) ?? []
			).filter((request) => request.type === "build-tree"),
		);
}

interface ProxyErrorBody {
	error: string;
	message: string;
	resetsAt?: string;
}

function answerAsTheProxy(httpStatus: number, body: ProxyErrorBody) {
	return {
		status: httpStatus,
		contentType: "application/json",
		headers: {
			"access-control-allow-origin": "*",
			"access-control-expose-headers": "Retry-After, Diffpack-Proxy-Error",
			"diffpack-proxy-error": body.error,
			"retry-after": "3600",
		},
		body: JSON.stringify(body),
	};
}

const QUOTA_EXHAUSTED = answerAsTheProxy(503, {
	error: "quota_exhausted",
	message: "diffpack's Composer proxy has used today's free allowance.",
	resetsAt: RESETS_AT,
});

test("compares two monolog releases through the proxy", async ({ page }) => {
	await page.goto(`${MONOLOG}/src/Monolog/Logger.php`);

	await expect(status(page)).toHaveText("129 files, 6 changed", ENGINE);
	await expect(page.getByTestId("diff-view")).toBeVisible(ENGINE);
	await expect(treeRow(page, "Logger.php").getByTestId("added")).toHaveText(
		"+7",
	);
	await expect(treeRow(page, "Logger.php").getByTestId("removed")).toHaveText(
		"-7",
	);
});

test("hydration adopts the boot script's Composer build rather than repeating it", async ({
	page,
}) => {
	const buildRequests = await recordBuildRequests(page);

	await page.goto(MONOLOG);
	await expect(status(page)).toHaveAttribute("data-state", "ready", ENGINE);

	expect(await buildRequests()).toEqual([
		expect.objectContaining({
			registry: "composer",
			pkg: "monolog/monolog",
			from: "3.12.0",
			to: "3.12.1",
		}),
	]);
});

test("picks two versions of a searched package and compares them", async ({
	page,
}) => {
	await page.goto("/composer");
	await untilHydrated(page);

	await field(page).fill("monolog");
	await option(page, "monolog/monolog").click();
	await expect(from(page)).toBeEnabled();

	await from(page).click();
	await page.getByRole("option", { name: "3.11.0", exact: true }).click();
	await page.getByRole("combobox", { name: "To Version" }).click();
	await page.getByRole("option", { name: "3.12.0", exact: true }).click();
	await page.getByRole("button", { name: "Compare" }).click();

	await expect(page).toHaveURL("/composer/monolog/monolog/3.11.0/3.12.0");
	await expect(status(page)).toHaveAttribute("data-state", "ready", ENGINE);
});

test("going back restores the previous Composer comparison", async ({
	page,
}) => {
	await page.goto(MONOLOG);
	await expect(status(page)).toHaveAttribute("data-state", "ready", ENGINE);
	await page.goto("/crates/serde/1.0.1/1.0.2");
	await expect(page.getByTestId("workspace")).toHaveAttribute(
		"data-package",
		"serde",
	);

	await page.goBack();

	await expect(page.getByTestId("workspace")).toHaveAttribute(
		"data-package",
		"monolog/monolog",
	);
	await expect(status(page)).toHaveAttribute("data-state", "ready", ENGINE);
});

test("ignoring whitespace rebuilds the Composer comparison that way", async ({
	page,
}) => {
	const buildRequests = await recordBuildRequests(page);
	await page.goto(`${MONOLOG}/src/Monolog/Logger.php`);
	await expect(page.getByTestId("diff-view")).toBeVisible(ENGINE);

	await page
		.getByTestId("diff-toolbar")
		.getByRole("button", { name: "Settings" })
		.click();
	await page.getByRole("button", { name: "Ignore whitespaces" }).click();

	await expect.poll(buildRequests).toEqual([
		expect.objectContaining({
			registry: "composer",
			ignoreWhitespace: false,
		}),
		expect.objectContaining({ registry: "composer", ignoreWhitespace: true }),
	]);
	await expect(status(page)).toHaveAttribute("data-state", "ready", ENGINE);
	await expect(page.getByTestId("diff-view")).toBeVisible(ENGINE);
});

test.describe("when the proxy cannot serve, a state no real package produces, so only the proxy is stubbed", () => {
	test.use({ locale: "en-US", timezoneId: "Europe/Warsaw" });

	test("a used-up daily quota pauses Composer until a local time", async ({
		page,
	}) => {
		await page.route(`${PROXY}/v1/composer/**`, (route) =>
			route.fulfill(QUOTA_EXHAUSTED),
		);

		await page.goto(MONOLOG);

		await expect(status(page)).toHaveAttribute("data-state", "error", ENGINE);
		await expect(notice(page)).toHaveAttribute("data-code", "quota_exhausted");
		await expect(notice(page)).toContainText(
			"Composer diffs are paused for today.",
		);
		await expect(notice(page)).toContainText("It comes back at 7:30 AM GMT+2.");
	});

	test("an archive download the proxy refuses fails the comparison with the notice", async ({
		page,
	}) => {
		await page.route(`${PROXY}/v1/composer/archive**`, (route) =>
			route.fulfill(QUOTA_EXHAUSTED),
		);

		await page.goto(MONOLOG);

		await expect(status(page)).toHaveAttribute("data-state", "error", ENGINE);
		await expect(notice(page)).toHaveAttribute("data-code", "quota_exhausted");
		await expect(from(page)).not.toHaveAttribute(
			"placeholder",
			"Versions unavailable",
		);
	});

	test("a proxy that does not answer says so", async ({ page }) => {
		await page.route(`${PROXY}/v1/composer/**`, (route) => route.abort());

		await page.goto(MONOLOG);

		await expect(status(page)).toHaveAttribute("data-state", "error", ENGINE);
		await expect(notice(page)).toHaveAttribute(
			"data-code",
			"proxy_unreachable",
		);
		await expect(notice(page)).toContainText(
			"diffpack couldn't reach its Composer download proxy.",
		);
	});

	test("a version list the proxy refuses shows the notice, not an empty list", async ({
		page,
	}) => {
		await page.route(`${PROXY}/v1/composer/p2/**`, (route) =>
			route.fulfill(QUOTA_EXHAUSTED),
		);

		await page.goto("/composer/monolog/monolog");

		await expect(notice(page)).toHaveAttribute("data-code", "quota_exhausted");
		await expect(from(page)).toHaveAttribute(
			"placeholder",
			"Versions unavailable",
		);
		await expect(page.getByText("No versions")).toHaveCount(0);
	});
});
