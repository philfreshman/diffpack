import { describe, expect, test } from "bun:test";
import { createCachedDiffClient } from "#/lib/cache/cachedDiffClient.ts";
import { ENGINE_VERSION } from "#/lib/cache/diffKey.ts";
import type { CachedEntry } from "#/lib/cache/entryLookup.ts";
import type { EntryBoot } from "#/lib/worker/bootScript.ts";
import type {
	Comparison,
	DiffFileEntry,
	DiffRequest,
	FileDiff,
} from "#/lib/worker/protocol.ts";

const zod: Comparison = {
	registry: "npm",
	pkg: "zod",
	from: "3.25.76",
	to: "4.0.0",
	ignoreWhitespace: false,
};

const cachedTree: DiffFileEntry = {
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
		{ path: "README.md", type: "file", status: "unchanged" },
	],
};

const builtTree: DiffFileEntry = { ...cachedTree, path: "built-locally" };

const cachedPatch: FileDiff = { data: "-a\n+b\n", isDiff: true };
const localFile: FileDiff = { data: "# zod\n", isDiff: false };

const entry: CachedEntry = {
	tree: cachedTree,
	patches: new Map([["index.js", cachedPatch]]),
};

function localClient() {
	const calls: string[] = [];
	return {
		calls,
		client: {
			async buildTree(comparison: Comparison) {
				calls.push(`build ${comparison.pkg}`);
				return builtTree;
			},
			async getFile(_comparison: Comparison, path: string) {
				calls.push(`get ${path}`);
				return localFile;
			},
			async prefetch(request: DiffRequest) {
				calls.push(`prefetch ${request.pkg}`);
			},
		},
	};
}

function clientFinding(found: CachedEntry | null) {
	const local = localClient();
	const client = createCachedDiffClient(local.client, async () => found);
	return { client, calls: local.calls };
}

describe("a diff client in front of the server's cache", () => {
	test("builds no tree for a comparison the cache holds", async () => {
		const { client, calls } = clientFinding(entry);

		expect(await client.buildTree(zod)).toEqual(cachedTree);
		expect(calls).toEqual([]);
	});

	test("reads a changed file of a cached comparison from its patches", async () => {
		const { client, calls } = clientFinding(entry);
		await client.buildTree(zod);

		expect(await client.getFile(zod, "index.js", undefined)).toEqual(
			cachedPatch,
		);
		expect(calls).toEqual([]);
	});

	test("works out a file the cache has no patch for on this device", async () => {
		const { client, calls } = clientFinding(entry);
		await client.buildTree(zod);

		expect(await client.getFile(zod, "README.md", undefined)).toEqual(
			localFile,
		);
		expect(calls).toEqual(["build zod", "get README.md"]);
	});

	test("works out a file named like an object's own methods here", async () => {
		const { client, calls } = clientFinding(entry);
		await client.buildTree(zod);

		for (const path of ["constructor", "toString", "__proto__"]) {
			expect(await client.getFile(zod, path, undefined)).toEqual(localFile);
		}
		expect(calls).toContain("get constructor");
	});

	test("forgets a cached entry once the same comparison misses", async () => {
		const local = localClient();
		let found: CachedEntry | null = entry;
		const client = createCachedDiffClient(
			local.client,
			async () => found,
			() => null,
		);
		await client.buildTree(zod);

		found = null;
		await client.buildTree(zod);

		expect(await client.getFile(zod, "index.js", undefined)).toEqual(localFile);
	});

	test("asks the worker for a file of any comparison but the cached one", async () => {
		const { client, calls } = clientFinding(entry);
		await client.buildTree(zod);

		await client.getFile({ ...zod, to: "4.1.0" }, "index.js", undefined);

		expect(calls).toEqual(["get index.js"]);
	});

	test("builds a cached comparison here again after a build that failed", async () => {
		const local = localClient();
		let failing = true;
		const client = createCachedDiffClient(
			{
				...local.client,
				async buildTree(comparison: Comparison) {
					if (failing) throw new Error("download failed");
					return local.client.buildTree(comparison);
				},
			},
			async () => ({ tree: cachedTree, patches: new Map() }),
			() => null,
		);
		await client.buildTree(zod);

		await expect(client.getFile(zod, "README.md", undefined)).rejects.toThrow(
			"download failed",
		);
		failing = false;

		expect(await client.getFile(zod, "README.md", undefined)).toEqual(
			localFile,
		);
	});

	test("builds on this device what the cache does not hold", async () => {
		const { client, calls } = clientFinding(null);

		expect(await client.buildTree(zod)).toEqual(builtTree);
		expect(await client.getFile(zod, "index.js", undefined)).toEqual(localFile);
		expect(calls).toEqual(["build zod", "get index.js"]);
	});

	test("builds on this device when the lookup itself breaks", async () => {
		const local = localClient();
		const client = createCachedDiffClient(local.client, () =>
			Promise.reject(new Error("lookup broke")),
		);

		expect(await client.buildTree(zod)).toEqual(builtTree);
		expect(local.calls).toEqual(["build zod"]);
	});

	test("builds a cached comparison here once, however many files it lacks", async () => {
		const { client, calls } = clientFinding({
			tree: cachedTree,
			patches: new Map(),
		});
		await client.buildTree(zod);

		await Promise.all([
			client.getFile(zod, "index.js", undefined),
			client.getFile(zod, "README.md", undefined),
		]);

		expect(calls.filter((call) => call.startsWith("build"))).toEqual([
			"build zod",
		]);
	});

	test("warms downloads the way the worker does", async () => {
		const { client, calls } = clientFinding(entry);

		await client.prefetch(zod);

		expect(calls).toEqual(["prefetch zod"]);
	});
});

function servedFor(comparison: Comparison) {
	return {
		schema: 1,
		engine: ENGINE_VERSION,
		registry: comparison.registry,
		package: comparison.pkg,
		from: comparison.from,
		to: comparison.to,
		similarity_threshold: 0.75,
		ignore_whitespace: comparison.ignoreWhitespace,
		tree: cachedTree,
		patches: { "index.js": { data: cachedPatch.data, is_diff: true } },
	};
}

function clientAfterBoot(booted: EntryBoot, found: CachedEntry | null = null) {
	const local = localClient();
	const asked: Comparison[] = [];
	const client = createCachedDiffClient(
		local.client,
		async (comparison) => {
			asked.push(comparison);
			return found;
		},
		() => booted,
	);
	return { client, calls: local.calls, asked };
}

describe("a diff client adopting the boot script's lookup", () => {
	test("takes the cached tree the boot script found, asking nothing again", async () => {
		const { client, calls, asked } = clientAfterBoot({
			comparison: zod,
			served: Promise.resolve(servedFor(zod)),
			abandoned: false,
		});

		expect(await client.buildTree(zod)).toEqual(cachedTree);
		expect(await client.getFile(zod, "index.js", undefined)).toEqual(
			cachedPatch,
		);
		expect(asked).toEqual([]);
		expect(calls).toEqual([]);
	});

	test("builds here, without asking again, when the boot script missed", async () => {
		const { client, calls, asked } = clientAfterBoot({
			comparison: zod,
			served: Promise.resolve(null),
			abandoned: false,
		});

		expect(await client.buildTree(zod)).toEqual(builtTree);
		expect(asked).toEqual([]);
		expect(calls).toEqual(["build zod"]);
	});

	test("builds here when what the boot script found is not this comparison's entry", async () => {
		const { client, calls } = clientAfterBoot({
			comparison: zod,
			served: Promise.resolve({ ...servedFor(zod), package: "Zod" }),
			abandoned: false,
		});

		expect(await client.buildTree(zod)).toEqual(builtTree);
		expect(calls).toEqual(["build zod"]);
	});

	test("asks for itself about any other comparison", async () => {
		const other = { ...zod, to: "4.1.0" };
		const { client, asked } = clientAfterBoot(
			{
				comparison: zod,
				served: Promise.resolve(servedFor(zod)),
				abandoned: false,
			},
			entry,
		);

		await client.buildTree(other);

		expect(asked).toEqual([other]);
	});

	test("adopts the boot script's answer once", async () => {
		const { client, asked } = clientAfterBoot(
			{
				comparison: zod,
				served: Promise.resolve(servedFor(zod)),
				abandoned: false,
			},
			entry,
		);

		await client.buildTree(zod);
		await client.buildTree(zod);

		expect(asked).toEqual([zod]);
	});

	test("warms nothing until the boot script's lookup has settled", async () => {
		let settle: (served: unknown) => void = () => {};
		const served = new Promise<unknown>((resolve) => {
			settle = resolve;
		});
		const { client, calls } = clientAfterBoot({
			comparison: zod,
			served,
			abandoned: false,
		});

		const warming = client.prefetch(zod);
		await Promise.resolve();
		expect(calls).toEqual([]);

		settle(null);
		await warming;
		expect(calls).toEqual(["prefetch zod"]);
	});

	test("tells the boot script to stand down when another comparison is asked for", async () => {
		const booted: EntryBoot = {
			comparison: zod,
			served: new Promise(() => {}),
			abandoned: false,
		};
		const { client } = clientAfterBoot(booted, null);

		void client.buildTree({ ...zod, to: "4.1.0" });

		expect(booted.abandoned).toBe(true);
	});
});
