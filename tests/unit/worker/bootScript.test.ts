import { describe, expect, test } from "bun:test";
import { composerAdapter } from "#/lib/registries/composer.ts";
import { parseSlug } from "#/lib/url/slug.ts";
import {
	buildDiffBootScript,
	type DiffBoot,
	type EntryBoot,
} from "#/lib/worker/bootScript.ts";
import { createDiffClient } from "#/lib/worker/diffWorkerClient.ts";
import vectorFile from "../../../fixtures/cache-key-vectors.json" with {
	type: "json",
};
import { bodyArrivingAfter } from "../cache/slowBody.ts";

const WORKER_URL = "/assets/diff.worker-test.js";
const CACHE_ORIGIN = "https://cache.example";

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

const missing: Fetch = async () => new Response("", { status: 404 });

interface BootOptions {
	crypto?: unknown;
	meanwhile?: (window: Record<string, unknown>) => void;
	stored?: Record<string, string>;
	store?: unknown;
	fetch?: Fetch;
	engine?: string;
}

async function boot(
	pathname: string,
	{
		stored = {},
		store = { getItem: (key: string) => stored[key] ?? null },
		fetch = missing,
		engine = "0.4.1",
		meanwhile = () => {},
		crypto = globalThis.crypto,
	}: BootOptions = {},
) {
	const posted: unknown[] = [];
	const spawned: Array<{ url: string; options: unknown }> = [];
	const fetched: Array<{ url: string; init?: RequestInit }> = [];

	class FakeWorker {
		onmessage: ((event: { data: unknown }) => void) | null = null;

		constructor(url: string, options: unknown) {
			spawned.push({ url, options });
		}

		postMessage(request: unknown) {
			posted.push(request);
		}
	}

	const window: Record<string, unknown> = {};
	const recordingFetch: Fetch = (url, init) => {
		fetched.push({ url, init });
		return fetch(url, init);
	};

	new Function(
		"window",
		"location",
		"localStorage",
		"Worker",
		"fetch",
		"crypto",
		buildDiffBootScript(WORKER_URL, {
			origin: CACHE_ORIGIN,
			engine,
			timeoutMs: 50,
		}),
	)(window, { pathname }, store, FakeWorker, recordingFetch, crypto);

	meanwhile(window);
	await (window.__diffpackEntryBoot as EntryBoot | undefined)?.served;

	return { posted, spawned, fetched, window };
}

describe("the diff boot script", () => {
	test("posts the build-tree request a crates deep link names", async () => {
		const { posted } = await boot(
			"/crates/linux-raw-sys/0.6.5/0.12.1/Cargo.toml",
		);

		expect(posted).toEqual([
			{
				id: 0,
				type: "build-tree",
				registry: "crates",
				pkg: "linux-raw-sys",
				from: "0.6.5",
				to: "0.12.1",
				ignoreWhitespace: false,
			},
		]);
	});

	test("starts nothing where the URL names no comparison", async () => {
		for (const pathname of [
			"/",
			"/crates",
			"/crates/linux-raw-sys",
			"/crates/linux-raw-sys/0.6.5",
		]) {
			const { spawned, posted, window } = await boot(pathname);

			expect(spawned).toEqual([]);
			expect(posted).toEqual([]);
			expect(window).toEqual({});
		}
	});

	test("reads a scoped npm name as the two segments it spans", async () => {
		const { posted } = await boot("/npm/@types/node/26.0.0/26.7.0/index.d.ts");

		expect(posted).toEqual([
			{
				id: 0,
				type: "build-tree",
				registry: "npm",
				pkg: "@types/node",
				from: "26.0.0",
				to: "26.7.0",
				ignoreWhitespace: false,
			},
		]);
	});

	test("reads a go module name as everything up to the first version", async () => {
		const { posted } = await boot("/go/github.com/go-chi/chi/v5/v5.0.0/v5.3.1");

		expect(posted).toEqual([
			{
				id: 0,
				type: "build-tree",
				registry: "go",
				pkg: "github.com/go-chi/chi/v5",
				from: "v5.0.0",
				to: "v5.3.1",
				ignoreWhitespace: false,
			},
		]);
	});

	test("reads a composer name as its vendor and package, lowercased", async () => {
		const { posted } = await boot(
			"/composer/Monolog/Monolog/3.12.0/3.12.1/src/Monolog/Logger.php",
		);

		expect(posted).toEqual([
			{
				id: 0,
				type: "build-tree",
				registry: "composer",
				pkg: "monolog/monolog",
				from: "3.12.0",
				to: "3.12.1",
				ignoreWhitespace: false,
			},
		]);
	});

	test("agrees with parseSlug on every composer URL", async () => {
		for (const pathname of [
			"/composer/monolog/monolog/3.12.0/3.12.1/src/Monolog/Logger.php",
			"/composer/symfony/console/v7.3.0/v7.3.1",
			"/composer/Symfony/Console/v7.3.0/v7.3.1/Application.php",
			"/composer/doctrine/dbal/4.0.0-RC1/4.0.0",
		]) {
			const slug = parseSlug(
				composerAdapter,
				pathname.replace("/composer/", ""),
			);
			const { posted } = await boot(pathname);

			expect(posted).toMatchObject([
				{ pkg: slug.package, from: slug.from, to: slug.to },
			]);
		}
	});

	test("leaves behind a request the client adopts as the same comparison", async () => {
		const { posted, window } = await boot("/npm/@types/node/26.0.0/26.7.0");
		const booted = window.__diffpackDiffBoot as DiffBoot;
		const client = createDiffClient(
			() => {
				throw new Error("spawned a second worker");
			},
			() => booted,
		);

		void client.buildTree({
			registry: "npm",
			pkg: "@types/node",
			from: "26.0.0",
			to: "26.7.0",
			ignoreWhitespace: false,
		});

		expect(posted).toEqual([
			{ id: booted.id, type: "build-tree", ...booted.comparison },
		]);
	});

	test("starts nothing where the first segment names no registry", async () => {
		const { spawned, window } = await boot("/about/express/4.18.2/5.1.0");

		expect(spawned).toEqual([]);
		expect(window).toEqual({});
	});

	test("builds the tree with the stored whitespace answer", async () => {
		const { posted } = await boot("/crates/serde/1.0.0/1.0.1", {
			stored: { "ignore-whitespace-preference": "true" },
		});

		expect(posted).toMatchObject([{ ignoreWhitespace: true }]);
	});

	test("is whitespace-exact unless the stored answer says otherwise", async () => {
		const stores: Record<string, string>[] = [
			{},
			{ "ignore-whitespace-preference": "false" },
		];

		for (const stored of stores) {
			const { posted } = await boot("/crates/serde/1.0.0/1.0.1", { stored });

			expect(posted).toMatchObject([{ ignoreWhitespace: false }]);
		}
	});

	test("still boots, whitespace-exact, when the store refuses to be read", async () => {
		// A private-mode store can throw on read.
		const refusing = {
			getItem() {
				throw new Error("SecurityError");
			},
		};

		const { posted } = await boot("/crates/serde/1.0.0/1.0.1", {
			store: refusing,
		});

		expect(posted).toMatchObject([{ ignoreWhitespace: false }]);
	});
});

const servedEntry = {
	tree: { path: "", type: "directory", status: "modified" },
};

const answering: Fetch = async () => Response.json(servedEntry);

function pathOf(input: (typeof vectorFile.vectors)[number]["input"]): string {
	return `/${input.registry}/${input.package}/${input.from}/${input.to}`;
}

describe("the diff boot script, in front of the server's cache", () => {
	test("asks the cache before it starts a worker, and starts none on a hit", async () => {
		const { spawned, posted, window } = await boot(
			"/npm/@types/node/20.11.0/22.0.0",
			{ fetch: answering, engine: "0.3.0" },
		);

		expect(spawned).toEqual([]);
		expect(posted).toEqual([]);
		expect(await (window.__diffpackEntryBoot as EntryBoot).served).toEqual(
			servedEntry,
		);
	});

	test("starts the worker when the cache misses, fails or stalls", async () => {
		const stalling: Fetch = (_url, init) =>
			new Promise((_resolve, reject) =>
				init?.signal?.addEventListener("abort", () =>
					reject(init.signal?.reason),
				),
			);
		const failing: Fetch = () => Promise.reject(new TypeError("offline"));

		for (const fetch of [missing, failing, stalling]) {
			const { posted } = await boot("/crates/serde/1.0.0/1.0.1", { fetch });

			expect(posted).toMatchObject([{ type: "build-tree", pkg: "serde" }]);
		}
	});

	test("lets an answer that has begun to arrive finish, and starts no worker", async () => {
		const slowBody: Fetch = async (_url, init) =>
			new Response(
				bodyArrivingAfter(120, JSON.stringify(servedEntry), init?.signal),
			);

		const { spawned } = await boot("/crates/serde/1.0.0/1.0.1", {
			fetch: slowBody,
		});

		expect(spawned).toEqual([]);
	});

	test("starts no worker for a comparison the page has moved on from", async () => {
		let release: () => void = () => {};
		const answerLater = new Promise<void>((resolve) => {
			release = resolve;
		});
		const missingLater: Fetch = async (url, init) => {
			await answerLater;
			return missing(url, init);
		};

		const { spawned } = await boot("/crates/serde/1.0.0/1.0.1", {
			fetch: missingLater,
			meanwhile: (window) => {
				(window.__diffpackEntryBoot as EntryBoot).abandoned = true;
				release();
			},
		});

		expect(spawned).toEqual([]);
	});

	test("starts the worker where the page cannot hash, outside a secure context", async () => {
		const { posted, fetched } = await boot("/crates/serde/1.0.0/1.0.1", {
			crypto: {},
		});

		expect(fetched).toEqual([]);
		expect(posted).toMatchObject([{ type: "build-tree", pkg: "serde" }]);
	});

	test("sends only the diff_id, with no cookies and no referrer", async () => {
		const { fetched } = await boot("/npm/@types/node/20.11.0/22.0.0", {
			engine: "0.3.0",
		});

		expect(fetched.map((each) => each.url)).toEqual([
			`${CACHE_ORIGIN}/diffs/v1/4cd94d033fa83b9f14526c29c6f47f1e3b9e263e836d73ee5973a543b5a0777c`,
		]);
		expect(fetched[0]?.init).toMatchObject({
			credentials: "omit",
			referrerPolicy: "no-referrer",
		});
	});

	test("keys a deep link the way the server does, for every vector a URL can name", async () => {
		const expressible = vectorFile.vectors.filter(
			(vector) =>
				vector.input.schema === 1 && vector.input.similarity_threshold === 0.75,
		);
		expect(expressible.length).toBeGreaterThan(10);

		for (const { input, diff_id } of expressible) {
			const { fetched } = await boot(pathOf(input), {
				engine: input.engine,
				stored: {
					"ignore-whitespace-preference": String(input.ignore_whitespace),
				},
			});

			expect(fetched.map((each) => each.url)).toEqual([
				`${CACHE_ORIGIN}/diffs/v1/${diff_id}`,
			]);
		}
	});
});
