import { describe, expect, test } from "bun:test";
import { GA_MEASUREMENT_ID, GA_SCRIPT, GA_SRC } from "#/lib/analytics.ts";

describe("Google Analytics", () => {
	test("keeps the old site's property, so the traffic history stays continuous", () => {
		expect(GA_MEASUREMENT_ID).toBe("G-JH9PM7WWGG");
	});

	test("loads gtag.js for the property it configures", () => {
		const src = new URL(GA_SRC);

		expect(src.origin).toBe("https://www.googletagmanager.com");
		expect(src.searchParams.get("id")).toBe(GA_MEASUREMENT_ID);
		expect(GA_SCRIPT).toContain(
			`gtag("config",${JSON.stringify(GA_MEASUREMENT_ID)})`,
		);
	});
});
