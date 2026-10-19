import { describe, expect, test } from "bun:test";
import { createEntryLookup } from "#/lib/cache/entryLookup.ts";
import type { DiffFileEntry } from "#/lib/worker/protocol.ts";
import vectorFile from "../../../fixtures/cache-key-vectors.json" with {
	type: "json",
};
import { json, stubFetch } from "../registries/fetchStub.ts";
import { bodyArrivingAfter } from "./slowBody.ts";

const ORIGIN = "https://cache.example";
const ENGINE = "0.4.1";

const zod = {
	registry: "npm",
	pkg: "zod",
	from: "3.25.76",
	to: "4.0.0",
	ignoreWhitespace: false,
};

const ZOD_DIFF_ID = vectorFile.vectors.find(
	(vector) => vector.name === "npm/zod at engine 0.4.1",
)?.diff_id;

const tree: DiffFileEntry = {
	path: "",
	type: "directory",
	status: "modified",
	children: [
		{
			path: "index.js",
			type: "file",
			status: "modified",
			added: 1,
			removed: 1,
		},
	],
};

function servedEntry(overrides: Record<string, unknown> = {}) {
	return {
		schema: 1,
		engine: ENGINE,
		registry: "npm",
		package: "zod",
		from: "3.25.76",
		to: "4.0.0",
		similarity_threshold: 0.75,
		ignore_whitespace: false,
		tree,
		patches: { "index.js": { data: "-a\n+b\n", is_diff: true } },
		...overrides,
	};
}

function lookupAnswering(response: () => Response | Promise<Response>) {
	const { fetcher, calls } = stubFetch(response);
	const lookUp = createEntryLookup({
		fetcher,
		origin: ORIGIN,
		engine: ENGINE,
		timeoutMs: 50,
	});
	return { lookUp, calls };
}

describe("looking a comparison up in the server's cache", () => {
	test("reads the entry named by the comparison's diff_id", async () => {
		const { lookUp, calls } = lookupAnswering(() => json(servedEntry()));

		const entry = await lookUp(zod);

		expect(calls.map((call) => call.url)).toEqual([
			`${ORIGIN}/diffs/v1/${ZOD_DIFF_ID}`,
		]);
		expect(entry).toEqual({
			tree,
			patches: new Map([["index.js", { data: "-a\n+b\n", isDiff: true }]]),
		});
	});

	test("sends no cookies and no referrer, which would name the package", async () => {
		const { lookUp, calls } = lookupAnswering(() => json(servedEntry()));

		await lookUp(zod);

		expect(calls[0]?.init?.credentials).toBe("omit");
		expect(calls[0]?.init?.referrerPolicy).toBe("no-referrer");
	});

	test("is a miss when the server has no entry", async () => {
		const { lookUp } = lookupAnswering(() => json({}, 404));

		expect(await lookUp(zod)).toBeNull();
	});

	test("is a miss when the request fails", async () => {
		const { lookUp } = lookupAnswering(() => {
			throw new TypeError("Failed to fetch");
		});

		expect(await lookUp(zod)).toBeNull();
	});

	test("is a miss when the answer is not an entry", async () => {
		for (const body of [
			new Response("<html>not json</html>"),
			json(servedEntry({ tree: null })),
			json(servedEntry({ patches: { "index.js": { data: 42 } } })),
		]) {
			const { lookUp } = lookupAnswering(() => body);

			expect(await lookUp(zod)).toBeNull();
		}
	});

	test("is a miss when the entry is another comparison's", async () => {
		for (const other of [
			{ registry: "pypi" },
			{ package: "Zod" },
			{ from: "3.25.75" },
			{ to: "4.0.1" },
			{ engine: "0.4.0" },
			{ ignore_whitespace: true },
			{ schema: 2 },
			{ similarity_threshold: 0.6 },
		]) {
			const { lookUp } = lookupAnswering(() => json(servedEntry(other)));

			expect(await lookUp(zod)).toBeNull();
		}
	});

	test("takes an entry whose threshold agrees to the key's four decimals", async () => {
		const { lookUp } = lookupAnswering(() =>
			json(servedEntry({ similarity_threshold: 0.750000001 })),
		);

		expect(await lookUp(zod)).not.toBeNull();
	});

	test("lets an entry that has begun to arrive finish, however long it takes", async () => {
		const lookUp = createEntryLookup({
			fetcher: async (_url, init) =>
				new Response(
					bodyArrivingAfter(60, JSON.stringify(servedEntry()), init?.signal),
				),
			origin: ORIGIN,
			engine: ENGINE,
			timeoutMs: 20,
		});

		expect(await lookUp(zod)).not.toBeNull();
	});

	test("gives up on a server too slow to answer, and is a miss", async () => {
		let aborted = false;
		const lookUp = createEntryLookup({
			fetcher: (_url, init) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () => {
						aborted = true;
						reject(init.signal?.reason);
					});
				}),
			origin: ORIGIN,
			engine: ENGINE,
			timeoutMs: 20,
		});

		expect(await lookUp(zod)).toBeNull();
		expect(aborted).toBe(true);
	});
});
