import { describe, expect, test } from "bun:test";
import type { DiffBoot } from "#/lib/worker/bootScript.ts";
import { createDiffClient } from "#/lib/worker/diffWorkerClient.ts";
import type {
	Comparison,
	DiffFileEntry,
	WorkerRequest,
} from "#/lib/worker/protocol.ts";

const COMPARISON: Comparison = {
	registry: "crates",
	pkg: "linux-raw-sys",
	from: "0.6.5",
	to: "0.12.1",
	ignoreWhitespace: false,
};

/** Another pair of versions of the same crate. */
const ANOTHER: Comparison = { ...COMPARISON, to: "0.9.0" };

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

/**
 * A worker that answers the way the engine does: a build loads its two
 * versions into the cache when it *finishes*, and a file is read out of the
 * two versions the read names, which must have been loaded. A version in
 * `slow` is still downloading until the test says it has landed; every other
 * one downloads at once.
 */
class FakeEngine {
	onmessage: ((event: { data: unknown }) => void) | null = null;
	private readonly loaded = new Set<string>();
	private readonly downloading = new Map<string, () => void>();

	constructor(private readonly slow: ReadonlySet<string> = new Set()) {}

	postMessage(request: WorkerRequest) {
		if (request.type === "build-tree") {
			const finish = () => {
				this.loaded.add(request.from).add(request.to);
				this.reply({ id: request.id, ok: true, data: TREE });
			};
			if (this.slow.has(request.to)) this.downloading.set(request.to, finish);
			else setTimeout(finish, 0);
			return;
		}
		if (request.type === "get-file") {
			const missing = [request.from, request.to].find(
				(version) => !this.loaded.has(version),
			);
			const response = missing
				? { id: request.id, ok: false, error: `${missing} has not been loaded` }
				: {
						id: request.id,
						ok: true,
						data: {
							data: `${request.from}..${request.to} ${request.path}`,
							isDiff: true,
						},
					};
			setTimeout(() => this.reply(response), 0);
		}
	}

	/** `version`'s download lands, and the build waiting on it finishes. */
	download(version: string) {
		this.downloading.get(version)?.();
	}

	private reply(response: unknown) {
		this.onmessage?.({ data: response });
	}
}

/** Lets pending timers and the microtasks behind them run. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * `reply`, if it lands within a few timer turns; otherwise a failure, rather
 * than a test left waiting on a download the fake never finishes.
 */
function prompt<T>(reply: Promise<T>): Promise<T> {
	const heldUp = settled()
		.then(settled)
		.then(() => Promise.reject(new Error("held up")));
	return Promise.race([reply, heldUp]);
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

/** The client, over a worker that behaves like the engine. */
function clientOver(engine: FakeEngine) {
	return createDiffClient(
		() => engine as unknown as Worker,
		() => null,
	);
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

		// Beside the boot's build, not behind it: a read names its comparison,
		// so it does not matter which of the two finishes last.
		client.buildTree({ ...COMPARISON, ignoreWhitespace: true });

		expect(spawned).toEqual([]);
		expect(booted.posted).toEqual([
			{ id: 1, type: "build-tree", ...COMPARISON, ignoreWhitespace: true },
		]);
	});

	test("does not hand the boot's tree back once another comparison has been asked for", () => {
		const booted = new FakeWorker();
		const { client } = clientWith(bootOf(booted));

		client.buildTree(ANOTHER);
		client.buildTree(COMPARISON);

		// The boot's tree answers the page's first ask, so coming back to its
		// comparison is a request of its own.
		expect(booted.posted).toEqual([
			{ id: 1, type: "build-tree", ...ANOTHER },
			{ id: 2, type: "build-tree", ...COMPARISON },
		]);
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

describe("a file read by the comparison it belongs to", () => {
	test("a file is read out of the comparison it was asked of, not the build that finished last", async () => {
		// `ANOTHER`'s newer version is not in the cache yet.
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

	test("a file is read out of its own comparison once another has been built after it", async () => {
		const client = clientOver(new FakeEngine());
		await client.buildTree(COMPARISON);
		await client.buildTree(ANOTHER);

		const file = await client.getFile(COMPARISON, "Cargo.toml", undefined);
		expect(file.data).toBe("0.6.5..0.12.1 Cargo.toml");
	});

	test("a read is not held up by another comparison's build still downloading", async () => {
		// `ANOTHER`'s newer version never lands.
		const client = clientOver(new FakeEngine(new Set([ANOTHER.to])));
		await client.buildTree(COMPARISON);
		void client.buildTree(ANOTHER);

		const file = await prompt(
			client.getFile(COMPARISON, "Cargo.toml", undefined),
		);
		expect(file.data).toBe("0.6.5..0.12.1 Cargo.toml");
	});

	test("a failed build does not stop the comparison built before it being read", async () => {
		const { client, spawned } = clientWith(null);
		const built = client.buildTree(COMPARISON);
		await settled();
		spawned[0]?.reply({ id: 0, ok: true, data: TREE });
		await built;
		const failed = client.buildTree(ANOTHER);
		await settled();
		spawned[0]?.reply({ id: 1, ok: false, error: "404 Not Found" });
		await expect(failed).rejects.toThrow("404 Not Found");

		const read = client.getFile(COMPARISON, "Cargo.toml", "Cargo.toml.orig");

		expect(spawned[0]?.posted[2]).toEqual({
			id: 2,
			type: "get-file",
			...COMPARISON,
			path: "Cargo.toml",
			oldPath: "Cargo.toml.orig",
		});
		const diff = { data: "@@ -1 +1 @@", isDiff: true };
		spawned[0]?.reply({ id: 2, ok: true, data: diff });
		expect(await read).toEqual(diff);
	});

	test("a failed build holds up nothing behind it", async () => {
		const { client, spawned } = clientWith(null);
		const failed = client.buildTree(ANOTHER);
		await settled();
		const next = client.buildTree(COMPARISON);
		// Heard before it lands: nothing else is listening for the failure.
		const refusal = failed.then(
			() => null,
			(error: Error) => error.message,
		);

		spawned[0]?.reply({ id: 0, ok: false, error: "404 Not Found" });
		await settled();
		spawned[0]?.reply({ id: 1, ok: true, data: TREE });

		expect(await refusal).toBe("404 Not Found");
		expect(await next).toEqual(TREE);
	});

	test("going back to a comparison is not held up by a build still downloading", async () => {
		// `ANOTHER`'s newer version never lands.
		const client = clientOver(new FakeEngine(new Set([ANOTHER.to])));
		await client.buildTree(COMPARISON);
		void client.buildTree(ANOTHER);
		await settled();

		expect(await prompt(client.buildTree(COMPARISON))).toEqual(TREE);
	});
});
