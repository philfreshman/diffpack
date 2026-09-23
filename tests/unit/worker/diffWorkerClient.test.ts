import { describe, expect, test } from "bun:test";
import type { DiffBoot } from "#/lib/worker/bootScript.ts";
import { createDiffClient } from "#/lib/worker/diffWorkerClient.ts";
import type { Comparison, DiffFileEntry } from "#/lib/worker/protocol.ts";

const COMPARISON: Comparison = {
	registry: "crates",
	pkg: "linux-raw-sys",
	from: "0.6.5",
	to: "0.12.1",
	ignoreWhitespace: false,
};

const TREE: DiffFileEntry = {
	path: "",
	type: "directory",
	status: "modified",
	children: [{ path: "Cargo.toml", type: "file", status: "modified" }],
};

/** A worker the test speaks for: it records what it was sent and replies by hand. */
class FakeWorker {
	onmessage: ((event: { data: unknown }) => void) | null = null;
	readonly posted: unknown[] = [];

	postMessage(request: unknown) {
		this.posted.push(request);
	}

	reply(response: unknown) {
		this.onmessage?.({ data: response });
	}
}

function bootOf(worker: FakeWorker, replies: unknown[] = []): DiffBoot {
	return {
		worker: worker as unknown as Worker,
		id: 0,
		comparison: COMPARISON,
		replies,
	};
}

/** The client, plus the workers it would have had to spawn for itself. */
function clientWith(boot: DiffBoot | null) {
	const spawned: FakeWorker[] = [];

	const client = createDiffClient(
		() => {
			const worker = new FakeWorker();
			spawned.push(worker);
			return worker as unknown as Worker;
		},
		() => boot,
	);

	return { client, spawned };
}

describe("createDiffClient", () => {
	test("adopts the request the boot script already has in flight", async () => {
		const booted = new FakeWorker();
		const { client, spawned } = clientWith(bootOf(booted));

		const tree = client.buildTree(COMPARISON);

		expect(spawned).toEqual([]);
		expect(booted.posted).toEqual([]);

		booted.reply({ id: 0, ok: true, data: TREE });
		expect(await tree).toEqual(TREE);
	});

	test("resolves from replies that landed before the client existed", async () => {
		const booted = new FakeWorker();
		const { client } = clientWith(
			bootOf(booted, [{ id: 0, ok: true, data: TREE }]),
		);

		expect(await client.buildTree(COMPARISON)).toEqual(TREE);
	});

	test("asks for itself when the boot script started another comparison", () => {
		const booted = new FakeWorker();
		const { client, spawned } = clientWith(bootOf(booted));

		client.buildTree({ ...COMPARISON, ignoreWhitespace: true });

		expect(spawned).toEqual([]);
		expect(booted.posted).toEqual([
			{ id: 1, type: "build-tree", ...COMPARISON, ignoreWhitespace: true },
		]);
	});

	test("does not hand the boot's tree back once another comparison has replaced it", () => {
		const booted = new FakeWorker();
		const { client } = clientWith(bootOf(booted));

		client.buildTree({ ...COMPARISON, to: "0.9.0" });
		client.buildTree(COMPARISON);

		// The engine holds one active diff, so the second ask has to be a real
		// request: the boot's tree would describe a comparison no longer loaded.
		expect(booted.posted).toEqual([
			{ id: 1, type: "build-tree", ...COMPARISON, to: "0.9.0" },
			{ id: 2, type: "build-tree", ...COMPARISON },
		]);
	});

	test("spawns its own worker where nothing was booted", async () => {
		const { client, spawned } = clientWith(null);

		const tree = client.buildTree(COMPARISON);

		expect(spawned).toHaveLength(1);
		expect(spawned[0]?.posted).toEqual([
			{ id: 0, type: "build-tree", ...COMPARISON },
		]);

		spawned[0]?.reply({ id: 0, ok: true, data: TREE });
		expect(await tree).toEqual(TREE);
	});
});
