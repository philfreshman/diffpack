import { describe, expect, test } from "bun:test";
import {
	composerAdapter,
	createComposerAdapter,
} from "#/lib/registries/composer.ts";
import { json, stubFetch } from "./fetchStub.ts";
import monologP2 from "./fixtures/monolog-p2.json" with { type: "json" };

describe("composer search", () => {
	test("asks Packagist directly and keeps each result's name and description", async () => {
		const { fetcher, calls } = stubFetch(() =>
			json({
				results: [
					{
						name: "monolog/monolog",
						description: "Sends your logs to files, sockets, inboxes",
						url: "https://packagist.org/packages/monolog/monolog",
						repository: "https://github.com/Seldaek/monolog",
						downloads: 1091256792,
						favers: 22270,
					},
				],
				total: 1,
			}),
		);

		const results = await createComposerAdapter(fetcher).search("mono log");

		expect(results).toEqual([
			{
				name: "monolog/monolog",
				description: "Sends your logs to files, sockets, inboxes",
			},
		]);
		expect(calls[0]?.url).toBe(
			"https://packagist.org/search.json?q=mono%20log&per_page=10",
		);
	});

	test("rejects a payload that is not a list of named results", async () => {
		const { fetcher } = stubFetch(() =>
			json({ results: [{ description: "nameless" }] }),
		);

		expect(createComposerAdapter(fetcher).search("monolog")).rejects.toThrow();
	});
});

describe("composer versions", () => {
	test("lists the tagged releases from the proxy's p2 file in Packagist's order", async () => {
		const { fetcher, calls } = stubFetch(() => json(monologP2));

		const versions = await createComposerAdapter(
			fetcher,
			"https://proxy.example",
		).versions("monolog/monolog");

		expect(versions).toEqual(["3.12.1", "3.12.0", "3.11.0"]);
		expect(calls[0]?.url).toBe(
			"https://proxy.example/v1/composer/p2/monolog/monolog.json",
		);
	});

	test("lists nothing for a package that has never tagged a release", async () => {
		const { fetcher } = stubFetch(() =>
			json({ minified: "composer/2.0", packages: { "acme/untagged": [] } }),
		);

		expect(
			await createComposerAdapter(fetcher).versions("acme/untagged"),
		).toEqual([]);
	});

	test("rejects when the proxy has no such package", async () => {
		const { fetcher } = stubFetch(() =>
			json({ error: "not_found", message: "No such package." }, 404),
		);

		expect(
			createComposerAdapter(fetcher).versions("acme/missing"),
		).rejects.toThrow(/acme\/missing/);
	});
});

describe("composer versions for a name that is not vendor/package", () => {
	test("rejects it without asking the proxy, which would refuse it anyway", async () => {
		const { fetcher, calls } = stubFetch(() => json(monologP2));
		const adapter = createComposerAdapter(fetcher);

		for (const name of ["../x", "monolog", "Monolog/Monolog", "a/b/c"]) {
			await expect(adapter.versions(name)).rejects.toThrow(name);
		}
		expect(calls).toEqual([]);
	});
});

describe("composer package path", () => {
	const { packagePath } = createComposerAdapter(
		stubFetch(() => json({})).fetcher,
	);

	test("takes the vendor and the package, and leaves the versions and file", () => {
		expect(
			packagePath.parse(["monolog", "monolog", "3.12.0", "3.12.1", "src"]),
		).toEqual({ name: "monolog/monolog", rest: ["3.12.0", "3.12.1", "src"] });
	});

	test("lowercases a name typed by hand, since Packagist names are lowercase", () => {
		expect(packagePath.parse(["Monolog", "Monolog"]).name).toBe(
			"monolog/monolog",
		);
		expect(packagePath.toSegments("Symfony/Console")).toEqual([
			"symfony",
			"console",
		]);
	});
});

describe("composer downloadUrl", () => {
	test("links the version on the package's Packagist page", () => {
		expect(composerAdapter.downloadUrl("monolog/monolog", "3.12.1")).toBe(
			"https://packagist.org/packages/monolog/monolog#3.12.1",
		);
	});

	test("sends a name that is not vendor/package to Packagist's search, not up the site's paths", () => {
		expect(composerAdapter.downloadUrl("../x", "1.0.0")).toBe(
			"https://packagist.org/search/?q=..%2Fx",
		);
	});
});
