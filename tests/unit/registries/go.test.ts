import { describe, expect, test } from "bun:test";
import { CodedError } from "#/lib/failure/failure.ts";
import { createGoAdapter, goAdapter } from "#/lib/registries/go.ts";
import { json, stubFetch, text } from "./fetchStub.ts";

const PROXY = "https://proxy.test";

describe("go packagePath.parse", () => {
	test("treats a major-version path suffix as part of the module path", () => {
		expect(
			goAdapter.packagePath.parse([
				"github.com",
				"go-chi",
				"chi",
				"v5",
				"v5.3.1",
				"v5.3.2",
				"tree.go",
			]),
		).toEqual({
			name: "github.com/go-chi/chi/v5",
			rest: ["v5.3.1", "v5.3.2", "tree.go"],
		});
	});

	test("takes the whole path when no version follows", () => {
		expect(
			goAdapter.packagePath.parse(["github.com", "spf13", "cobra"]),
		).toEqual({ name: "github.com/spf13/cobra", rest: [] });
	});

	test("returns an empty name for an empty path", () => {
		expect(goAdapter.packagePath.parse([])).toEqual({ name: "", rest: [] });
	});
});

describe("go packagePath.toSegments", () => {
	test("splits a module path back into its segments", () => {
		expect(
			goAdapter.packagePath.toSegments("github.com/go-chi/chi/v5"),
		).toEqual(["github.com", "go-chi", "chi", "v5"]);
	});

	test("round-trips a parsed name", () => {
		const segments = ["github.com", "go-chi", "chi", "v5"];
		const { name } = goAdapter.packagePath.parse([...segments, "v5.3.1"]);
		expect(goAdapter.packagePath.toSegments(name)).toEqual(segments);
	});
});

describe("go downloadUrl", () => {
	test("points at the module proxy zip for the version", () => {
		expect(goAdapter.downloadUrl("github.com/go-chi/chi/v5", "v5.3.1")).toBe(
			"https://proxy.golang.org/github.com/go-chi/chi/v5/@v/v5.3.1.zip",
		);
	});

	test("escapes uppercase letters, which the proxy serves lower-cased", () => {
		expect(
			goAdapter.downloadUrl("github.com/Masterminds/semver", "v3.2.1"),
		).toBe(
			"https://proxy.golang.org/github.com/!masterminds/semver/@v/v3.2.1.zip",
		);
	});
});

describe("go versions", () => {
	test("sorts the proxy's unordered list newest first", async () => {
		const { fetcher, calls } = stubFetch(() =>
			text("v5.3.1\nv5.10.0\nv5.2.0\nv5.3.2\n"),
		);

		const versions = await createGoAdapter(fetcher).versions(
			"github.com/go-chi/chi/v5",
		);

		expect(versions).toEqual(["v5.10.0", "v5.3.2", "v5.3.1", "v5.2.0"]);
		expect(calls[0]?.url).toBe(
			"https://proxy.golang.org/github.com/go-chi/chi/v5/@v/list",
		);
	});

	test("ranks a release above its own pre-releases", async () => {
		const { fetcher } = stubFetch(() =>
			text("v1.2.0-beta.1\nv1.2.0\nv1.2.0-beta.2\n"),
		);

		expect(await createGoAdapter(fetcher).versions("example.com/m")).toEqual([
			"v1.2.0",
			"v1.2.0-beta.2",
			"v1.2.0-beta.1",
		]);
	});

	test("ignores build metadata when ordering", async () => {
		const { fetcher } = stubFetch(() =>
			text("v2.0.0+incompatible\nv2.1.0+incompatible\n"),
		);

		expect(await createGoAdapter(fetcher).versions("example.com/m")).toEqual([
			"v2.1.0+incompatible",
			"v2.0.0+incompatible",
		]);
	});

	test("escapes uppercase letters in the module path", async () => {
		const { fetcher, calls } = stubFetch(() => text("v3.2.1\n"));

		await createGoAdapter(fetcher).versions("github.com/Masterminds/semver");

		expect(calls[0]?.url).toBe(
			"https://proxy.golang.org/github.com/!masterminds/semver/@v/list",
		);
	});
});

describe("go versions for untagged modules", () => {
	test("falls back to the pseudo-version when nothing is tagged", async () => {
		const { fetcher, calls } = stubFetch((url) =>
			url.endsWith("/@v/list")
				? text("")
				: json({ Version: "v0.0.0-20260101120000-abcdef123456" }),
		);

		const versions = await createGoAdapter(fetcher).versions("example.com/m");

		expect(versions).toEqual(["v0.0.0-20260101120000-abcdef123456"]);
		expect(calls[1]?.url).toBe(
			"https://proxy.golang.org/example.com/m/@latest",
		);
	});

	test("returns nothing when the proxy cannot resolve the module either", async () => {
		const { fetcher } = stubFetch((url) =>
			url.endsWith("/@v/list") ? text("") : text("not found", 404),
		);

		expect(await createGoAdapter(fetcher).versions("example.com/m")).toEqual(
			[],
		);
	});

	test("rejects when the version list itself fails", async () => {
		const { fetcher } = stubFetch(() => text("gone", 500));

		expect(createGoAdapter(fetcher).versions("example.com/m")).rejects.toThrow(
			/example.com\/m/,
		);
	});
});

describe("go search", () => {
	test("resolves a fully-typed module path to its newest version", async () => {
		const { fetcher } = stubFetch(() => text("v5.3.1\nv5.3.2\n"));

		const results = await createGoAdapter(fetcher).search(
			"github.com/go-chi/chi/v5",
		);

		expect(results).toEqual([
			{
				name: "github.com/go-chi/chi/v5",
				version: "v5.3.2",
				description: "Go module — 2 versions",
			},
		]);
	});

	test("treats a path that neither resolves nor matches as an ordinary miss", async () => {
		const { fetcher } = stubFetch((url) =>
			url.startsWith(PROXY)
				? json({ items: null, total: 0 })
				: text("not found", 404),
		);

		expect(
			await createGoAdapter(fetcher, PROXY).search(
				"example.com/does/not/exist",
			),
		).toEqual([]);
	});

	test("accepts a path the user pasted with a scheme or trailing slash", async () => {
		const { fetcher, calls } = stubFetch(() => text("v1.0.0\n"));

		const results = await createGoAdapter(fetcher).search(
			"https://github.com/spf13/cobra/",
		);

		expect(results[0]?.name).toBe("github.com/spf13/cobra");
		expect(calls[0]?.url).toBe(
			"https://proxy.golang.org/github.com/spf13/cobra/@v/list",
		);
	});
});

function goSearchAnswer(
	items: {
		packagePath: string;
		modulePath: string;
		version: string;
		synopsis?: string;
	}[],
): Response {
	return json({ items, total: items.length });
}

describe("go keyword search", () => {
	test("asks the diffpack proxy and lists each module once, in pkg.go.dev's order", async () => {
		const { fetcher, calls } = stubFetch(() =>
			goSearchAnswer([
				{
					packagePath: "github.com/go-chi/chi/v5",
					modulePath: "github.com/go-chi/chi/v5",
					version: "v5.5.0",
					synopsis: "Package chi is a small router.",
				},
				{
					packagePath: "github.com/go-chi/chi/v5/middleware",
					modulePath: "github.com/go-chi/chi/v5",
					version: "v5.5.0",
					synopsis: "",
				},
				{
					packagePath: "github.com/go-chi/cors",
					modulePath: "github.com/go-chi/cors",
					version: "v1.2.2",
					synopsis: "cors package is net/http handler to handle CORS.",
				},
			]),
		);

		const results = await createGoAdapter(fetcher, PROXY).search("chi");

		expect(calls.map((call) => call.url)).toEqual([
			"https://proxy.test/v1/go/search?q=chi",
		]);
		expect(results).toEqual([
			{
				name: "github.com/go-chi/chi/v5",
				version: "v5.5.0",
				description: "Package chi is a small router.",
			},
			{
				name: "github.com/go-chi/cors",
				version: "v1.2.2",
				description: "cors package is net/http handler to handle CORS.",
			},
		]);
	});

	test("leaves out the standard library, which the Go module proxy does not serve", async () => {
		const { fetcher } = stubFetch(() =>
			goSearchAnswer([
				{
					packagePath: "net/http",
					modulePath: "std",
					version: "v1.27.2",
					synopsis:
						"Package http provides HTTP client and server implementations.",
				},
				{
					packagePath: "cmd/go",
					modulePath: "cmd",
					version: "v1.27.2",
				},
				{
					packagePath: "github.com/gin-gonic/gin",
					modulePath: "github.com/gin-gonic/gin",
					version: "v1.12.0",
				},
			]),
		);

		const results = await createGoAdapter(fetcher, PROXY).search("http");

		expect(results.map((result) => result.name)).toEqual([
			"github.com/gin-gonic/gin",
		]);
	});
});

describe("go keyword search outcomes", () => {
	test("finds nothing when pkg.go.dev matches nothing", async () => {
		const { fetcher } = stubFetch(() => json({ items: null, total: 0 }));

		expect(await createGoAdapter(fetcher, PROXY).search("zzzz")).toEqual([]);
	});

	test("carries the proxy's code when it refuses the search", async () => {
		const { fetcher } = stubFetch(() => {
			const response = json(
				{
					error: "quota_exhausted",
					message: "diffpack's Composer proxy has used today's free allowance.",
					resetsAt: "2026-10-20T00:00:00Z",
				},
				503,
			);
			response.headers.set("Diffpack-Proxy-Error", "quota_exhausted");
			return response;
		});

		const failure = await createGoAdapter(fetcher, PROXY)
			.search("chi")
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(CodedError);
		expect(failure).toMatchObject({ code: "quota_exhausted" });
	});
});

describe("go keyword search limits", () => {
	test("lists at most ten modules", async () => {
		const items = Array.from({ length: 12 }, (_, index) => ({
			packagePath: `example.com/m${index}`,
			modulePath: `example.com/m${index}`,
			version: "v1.0.0",
		}));
		const { fetcher } = stubFetch(() => goSearchAnswer(items));

		const results = await createGoAdapter(fetcher, PROXY).search("m");

		expect(results.map((result) => result.name)).toEqual(
			items.slice(0, 10).map((item) => item.modulePath),
		);
	});

	test("does not ask the proxy for text longer than it accepts", async () => {
		const { fetcher, calls } = stubFetch(() => goSearchAnswer([]));

		expect(
			await createGoAdapter(fetcher, PROXY).search("a".repeat(101)),
		).toEqual([]);
		expect(calls).toHaveLength(0);
	});
});

describe("go module path search", () => {
	test("answers a resolvable path from the Go module proxy alone", async () => {
		const { fetcher, calls } = stubFetch(() => text("v5.3.2\n"));

		await createGoAdapter(fetcher, PROXY).search("github.com/go-chi/chi/v5");

		expect(calls.map((call) => call.url)).toEqual([
			"https://proxy.golang.org/github.com/go-chi/chi/v5/@v/list",
		]);
	});

	test("searches by keyword when the path does not resolve, such as a partial one", async () => {
		const { fetcher, calls } = stubFetch((url) =>
			url.startsWith(PROXY)
				? goSearchAnswer([
						{
							packagePath: "github.com/go-chi/chi/v5",
							modulePath: "github.com/go-chi/chi/v5",
							version: "v5.5.0",
						},
					])
				: text("not found", 404),
		);

		const results = await createGoAdapter(fetcher, PROXY).search(
			"https://github.com/go-chi/",
		);

		expect(results.map((result) => result.name)).toEqual([
			"github.com/go-chi/chi/v5",
		]);
		expect(calls.at(-1)?.url).toBe(
			"https://proxy.test/v1/go/search?q=github.com%2Fgo-chi",
		);
	});
});

describe("go search cancellation", () => {
	test("reports an aborted search rather than an empty result set", async () => {
		const controller = new AbortController();
		const { fetcher } = stubFetch(() => {
			controller.abort();
			throw new DOMException("The operation was aborted.", "AbortError");
		});

		expect(
			createGoAdapter(fetcher).search(
				"github.com/go-chi/chi/v5",
				controller.signal,
			),
		).rejects.toThrow(/abort/i);
	});
});
