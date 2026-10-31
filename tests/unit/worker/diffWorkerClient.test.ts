import { describe, expect, test } from "bun:test";
import { failureOf } from "#/lib/failure/failure.ts";
import type { DiffBoot } from "#/lib/worker/bootScript.ts";
import { createDiffClient } from "#/lib/worker/diffWorkerClient.ts";
import {
	type ArchiveFetched,
	type Comparison,
	type DiffFileEntry,
	failedReply,
	type WorkerRequest,
} from "#/lib/worker/protocol.ts";

const COMPARISON: Comparison = {
	registry: "crates",
	pkg: "linux-raw-sys",
	from: "0.6.5",
	to: "0.12.1",
	ignoreWhitespace: false,
};

const ANOTHER: Comparison = { ...COMPARISON, to: "0.9.0" };

const TREE: DiffFileEntry = {
	path: "",
	type: "directory",
	status: "modified",
	children: [{ path: "Cargo.toml", type: "file", status: "modified" }],
};

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

// Answers like the engine: a build replaces the active diff when it finishes. Versions in `slow` wait for `download`.
class FakeEngine {
	onmessage: ((event: { data: unknown }) => void) | null = null;
	private active: string | null = null;
	private readonly downloading = new Map<string, () => void>();

	constructor(private readonly slow: ReadonlySet<string> = new Set()) {}

	postMessage(request: WorkerRequest) {
		if (request.type === "build-tree") {
			const finish = () => {
				this.active = `${request.from}..${request.to}`;
				this.reply({ id: request.id, ok: true, data: TREE });
			};
			if (this.slow.has(request.to)) this.downloading.set(request.to, finish);
			else setTimeout(finish, 0);
			return;
		}
		if (request.type === "get-file") {
			const data = { data: `${this.active} ${request.path}`, isDiff: true };
			setTimeout(() => this.reply({ id: request.id, ok: true, data }), 0);
		}
	}

	download(version: string) {
		this.downloading.get(version)?.();
	}

	private reply(response: unknown) {
		this.onmessage?.({ data: response });
	}
}

const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

function bootOf(worker: FakeWorker, replies: unknown[] = []): DiffBoot {
	return {
		worker: worker as unknown as Worker,
		id: 0,
		comparison: COMPARISON,
		replies,
	};
}

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

function clientOver(engine: FakeEngine) {
	return createDiffClient(
		() => engine as unknown as Worker,
		() => null,
	);
}

describe("createDiffClient, finding its worker", () => {
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

	test("spawns its own worker where nothing was booted", async () => {
		const { client, spawned } = clientWith(null);

		const tree = client.buildTree(COMPARISON);
		await settled();

		expect(spawned).toHaveLength(1);
		expect(spawned[0]?.posted).toEqual([
			{ id: 0, type: "build-tree", ...COMPARISON },
		]);

		spawned[0]?.reply({ id: 0, ok: true, data: TREE });
		expect(await tree).toEqual(TREE);
	});
});

describe("createDiffClient, when the boot script started another comparison", () => {
	test("asks for itself, once the boot's build is done, when the boot script started another comparison", async () => {
		const booted = new FakeWorker();
		const { client, spawned } = clientWith(bootOf(booted));

		client.buildTree({ ...COMPARISON, ignoreWhitespace: true });
		await settled();
		expect(booted.posted).toEqual([]);

		booted.reply({ id: 0, ok: true, data: TREE });
		await settled();

		expect(spawned).toEqual([]);
		expect(booted.posted).toEqual([
			{ id: 1, type: "build-tree", ...COMPARISON, ignoreWhitespace: true },
		]);
	});

	test("does not hand the boot's tree back once another comparison has replaced it", async () => {
		const booted = new FakeWorker();
		const { client } = clientWith(bootOf(booted));

		client.buildTree(ANOTHER);
		booted.reply({ id: 0, ok: true, data: TREE });
		await settled();
		client.buildTree(COMPARISON);
		booted.reply({ id: 1, ok: true, data: TREE });
		await settled();

		expect(booted.posted).toEqual([
			{ id: 1, type: "build-tree", ...ANOTHER },
			{ id: 2, type: "build-tree", ...COMPARISON },
		]);
	});
});

describe("a build's progress", () => {
	const FROM_FETCHED: ArchiveFetched = { side: "from", failure: null };
	const TO_FAILED: ArchiveFetched = {
		side: "to",
		failure: { message: "404 fetching linux-raw-sys@0.12.1" },
	};

	test("reaches the caller as each archive arrives, without settling the build", async () => {
		const { client, spawned } = clientWith(null);
		const heard: ArchiveFetched[] = [];

		let done = false;
		const tree = client
			.buildTree(COMPARISON, (fetched) => heard.push(fetched))
			.finally(() => {
				done = true;
			});
		await settled();
		spawned[0]?.reply({ id: 0, fetched: FROM_FETCHED });
		await settled();

		expect(heard).toEqual([FROM_FETCHED]);
		expect(done).toBe(false);

		spawned[0]?.reply({ id: 0, ok: true, data: TREE });
		expect(await tree).toEqual(TREE);
	});

	test("of the boot's build reaches the client that claims it, including what came before", async () => {
		const booted = new FakeWorker();
		const { client } = clientWith(
			bootOf(booted, [{ id: 0, fetched: FROM_FETCHED }]),
		);
		const heard: ArchiveFetched[] = [];

		void client.buildTree(COMPARISON, (fetched) => heard.push(fetched));
		booted.reply({ id: 0, fetched: TO_FAILED });

		expect(heard).toEqual([FROM_FETCHED, TO_FAILED]);
	});

	test("of a build no one waits on any more is dropped", async () => {
		const { client, spawned } = clientWith(null);
		const heard: ArchiveFetched[] = [];

		void client.buildTree(COMPARISON, (fetched) => heard.push(fetched));
		await settled();
		spawned[0]?.reply({ id: 0, ok: true, data: TREE });
		spawned[0]?.reply({ id: 0, fetched: FROM_FETCHED });

		expect(heard).toEqual([]);
	});
});

describe("the engine's one active diff", () => {
	test("a file is read out of the comparison it was asked of, not the build that finished last", async () => {
		const engine = new FakeEngine(new Set([ANOTHER.to]));
		const client = clientOver(engine);
		await client.buildTree(COMPARISON);

		// Away to a pair still downloading, and back before it has landed.
		void client.buildTree(ANOTHER);
		await settled();
		const back = client.buildTree(COMPARISON);
		await settled();
		engine.download(ANOTHER.to);
		await back;

		const file = await client.getFile(COMPARISON, "Cargo.toml", undefined);
		expect(file.data).toBe("0.6.5..0.12.1 Cargo.toml");
	});

	test("a file is refused, not misread, once another comparison has replaced its own", async () => {
		const client = clientOver(new FakeEngine());
		await client.buildTree(COMPARISON);
		await client.buildTree(ANOTHER);

		await expect(
			client.getFile(COMPARISON, "Cargo.toml", undefined),
		).rejects.toThrow("Cargo.toml");
	});

	test("a read queued behind another comparison's build is refused when its turn comes", async () => {
		const client = clientOver(new FakeEngine());
		await client.buildTree(COMPARISON);
		void client.buildTree(ANOTHER);

		await expect(
			client.getFile(COMPARISON, "Cargo.toml", undefined),
		).rejects.toThrow("no longer loaded");
	});
});

describe("the engine's active diff, after a build fails or is overtaken", () => {
	test("a failed build leaves no comparison to read from", async () => {
		const { client, spawned } = clientWith(null);
		const built = client.buildTree(COMPARISON);
		await settled();
		spawned[0]?.reply({ id: 0, ok: true, data: TREE });
		await built;
		const failed = client.buildTree(ANOTHER);
		await settled();
		spawned[0]?.reply({ id: 1, ok: false, error: "404 Not Found" });
		await expect(failed).rejects.toThrow("404 Not Found");

		const read = client.getFile(COMPARISON, "Cargo.toml", undefined);
		await settled();

		// Checked before awaiting: a read the client did send would wait forever on this worker.
		expect(spawned[0]?.posted).toHaveLength(2);
		await expect(read).rejects.toThrow("no longer loaded");
	});

	test("a failed build holds up nothing behind it", async () => {
		const { client, spawned } = clientWith(null);
		const failed = client.buildTree(ANOTHER);
		await settled();
		const next = client.buildTree(COMPARISON);

		spawned[0]?.reply({ id: 0, ok: false, error: "404 Not Found" });
		await settled();
		spawned[0]?.reply({ id: 1, ok: true, data: TREE });

		await expect(failed).rejects.toThrow("404 Not Found");
		expect(await next).toEqual(TREE);
	});

	test("a build overtaken while it waited is never sent", async () => {
		const { client, spawned } = clientWith(null);
		void client.buildTree(ANOTHER);
		await settled();
		const overtaken = client.buildTree({
			...COMPARISON,
			ignoreWhitespace: true,
		});
		void client.buildTree(COMPARISON);

		spawned[0]?.reply({ id: 0, ok: true, data: TREE });
		await settled();

		// Checked before awaiting: a build the client did send would wait forever on this worker.
		expect(spawned[0]?.posted).toEqual([
			{ id: 0, type: "build-tree", ...ANOTHER },
			{ id: 1, type: "build-tree", ...COMPARISON },
		]);
		await expect(overtaken).rejects.toThrow("overtaken");
	});
});

describe("a failure's code", () => {
	test("reaches the caller from the engine, through the worker's reply", async () => {
		const { client, spawned } = clientWith(null);
		const failed = client.buildTree(COMPARISON);
		await settled();
		const thrown = Object.assign(new Error("Composer diffs are paused"), {
			code: "quota_exhausted",
			resetsAt: "2026-10-20T00:00:00Z",
			status: 503,
		});

		spawned[0]?.reply(failedReply(0, thrown));

		expect(failureOf(await failed.catch((error) => error))).toEqual({
			message: "Composer diffs are paused",
			code: "quota_exhausted",
			resetsAt: "2026-10-20T00:00:00Z",
			status: 503,
		});
	});

	test("is absent when the engine threw a plain string, as 0.4.1 does", async () => {
		const { client, spawned } = clientWith(null);
		const failed = client.buildTree(COMPARISON);
		await settled();

		spawned[0]?.reply(failedReply(0, "404 Not Found"));

		expect(failureOf(await failed.catch((error) => error))).toEqual({
			message: "404 Not Found",
		});
	});
});
