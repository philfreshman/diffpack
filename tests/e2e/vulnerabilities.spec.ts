import { expect, type Page, test } from "@playwright/test";

const LODASH = "/npm/lodash/4.17.20/4.17.21";
const NODE = "/npm/node/26.6.0/26.7.0";

const ENGINE = { timeout: 90_000 };

const TEMPLATE_FIX = "GHSA-35jh-r3h4-6jhm";
const TRIM_FIX = "GHSA-29mw-wpgm-hmr9";
const TEMPLATE_FIX_COMMIT = "3469357cff396a26c363f8c1b5a91dde28ba4b1c";
const THROW_LINE = 14914;

const TEMPLATE_FIX_PATCH = [
	"@@ -14866,6 +14908,12 @@ function template(string, options, guard) {",
	"       if (!variable) {",
	"         source = 'with (obj) {\\n' + source + '\\n}\\n';",
	"       }",
	"+      else if (reForbiddenIdentifierChars.test(variable)) {",
	"+        throw new Error(INVALID_TEMPL_VAR_ERROR_TEXT);",
	"+      }",
].join("\n");

async function stubGitHub(page: Page) {
	await page.route("https://api.github.com/repos/**", (route) =>
		route.request().url().endsWith(`/commits/${TEMPLATE_FIX_COMMIT}`)
			? route.fulfill({
					json: {
						files: [{ filename: "lodash.js", patch: TEMPLATE_FIX_PATCH }],
					},
				})
			: route.fulfill({ status: 404, json: { message: "Not Found" } }),
	);
}

async function ready(page: Page) {
	await expect(page.getByTestId("workspace")).toHaveAttribute(
		"data-state",
		"ready",
		ENGINE,
	);
}

const report = (page: Page) => page.getByTestId("vulnerability-report");

const entry = (page: Page, id: string) =>
	report(page).locator(`[data-testid="vulnerability-entry"][data-id="${id}"]`);

test("the loading box names the query to OSV.dev", async ({ page }) => {
	await page.goto(LODASH);

	await expect(page.getByTestId("progress-osv")).toHaveText(
		"Querying OSV.dev for lodash 4.17.20, 4.17.21",
	);
	await expect(
		page.getByTestId("diff-progress").getByRole("listitem"),
	).toHaveCount(4);
});

test("the loading box lists diffing as its last step", async ({ page }) => {
	await page.goto(LODASH);

	await expect(
		page.getByTestId("diff-progress").getByRole("listitem").last(),
	).toHaveText("Diffing");
});

test("the summary names the advisories an update fixes and those it keeps", async ({
	page,
}) => {
	await page.goto(LODASH);
	await ready(page);

	await expect(report(page)).toHaveAttribute("data-status", "ready");
	await expect(entry(page, TEMPLATE_FIX)).toHaveAttribute(
		"data-change",
		"fixed",
	);
	await expect(entry(page, TRIM_FIX)).toHaveAttribute("data-change", "fixed");
	await expect(
		report(page).locator(
			'[data-testid="vulnerability-entry"][data-change="remaining"]',
		),
	).not.toHaveCount(0);

	const link = entry(page, TEMPLATE_FIX).getByRole("link", {
		name: TEMPLATE_FIX,
	});
	await expect(link).toHaveAttribute(
		"href",
		`https://osv.dev/vulnerability/${TEMPLATE_FIX}`,
	);
	await expect(link).toHaveAttribute("target", "_blank");
});

test("says so when neither version has a known vulnerability", async ({
	page,
}) => {
	await page.goto(NODE);
	await ready(page);

	await expect(report(page)).toContainText(
		"No known vulnerabilities in 26.6.0 or 26.7.0.",
	);
	await expect(report(page).getByTestId("vulnerability-entry")).toHaveCount(0);
});

test("a failed query is reported without failing the comparison", async ({
	page,
}) => {
	await page.route("https://api.osv.dev/**", (route) => route.abort());
	await page.goto(NODE);
	await ready(page);

	await expect(report(page)).toHaveAttribute("data-status", "error");
	await expect(report(page)).toContainText("Could not reach OSV.dev");
	await expect(page.getByTestId("summary-files")).toBeVisible();
});

test("a fix links to the file it touched, and to the line", async ({
	page,
}) => {
	await stubGitHub(page);
	await page.goto(LODASH);
	await ready(page);

	await entry(page, TEMPLATE_FIX)
		.getByTestId("vulnerability-file")
		.filter({ hasText: /^lodash\.js$/ })
		.click();

	await expect(page).toHaveURL(`${LODASH}/lodash.js`);
	const notice = page.getByTestId("vulnerability-notice");
	await expect(notice).toContainText(TEMPLATE_FIX);

	await notice
		.getByRole("button", { name: `Go to line ${THROW_LINE}` })
		.click();

	await expect(page).toHaveURL(new RegExp(`#${THROW_LINE}$`));
	const selected = page.getByTestId("diff-view").locator("tr[data-selected]");
	await expect(selected).toContainText("INVALID_TEMPL_VAR_ERROR_TEXT");
	await expect(selected).toBeInViewport();
});
