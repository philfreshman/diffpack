import { type DiffBoot, readDiffBoot } from "./bootScript.ts";
import {
	type Comparison,
	comparisonKey,
	type DiffFileEntry,
	type DiffRequest,
	type FileDiff,
	type WorkerRequest,
	type WorkerRequestInput,
	type WorkerResponse,
} from "./protocol.ts";

type Pending = {
	resolve: (value: unknown) => void;
	reject: (reason: Error) => void;
};

export function createDiffClient(
	spawn: () => Worker,
	boot: () => DiffBoot | null = readDiffBoot,
) {
	const pending = new Map<number, Pending>();
	let nextId = 0;
	let worker: Worker | null = null;
	// Cleared once claimed *or* once another comparison is asked for: after a
	// second `build-tree` this tree would describe a diff no longer loaded.
	let adopted: { comparison: Comparison; tree: Promise<DiffFileEntry> } | null =
		null;
	// Builds and reads run one at a time. A download that never finishes stalls
	// everything behind it: the engine cannot cancel a build.
	let lane: Promise<unknown> = Promise.resolve();
	// `null` after a failed build, rather than guess what it left behind.
	let active: string | null = null;
	let buildsAsked = 0;

	function receive(message: WorkerResponse) {
		const entry = pending.get(message.id);
		if (!entry) return;
		pending.delete(message.id);
		if (message.ok) entry.resolve(message.data);
		else entry.reject(new Error(message.error));
	}

	function awaitReply<T>(id: number): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
		});
	}

	// One worker per document: a second would start with an empty wasm cache and
	// fail every `getFile` with "No active diff context".
	function getWorker(): Worker {
		if (worker) return worker;

		const booted = boot();
		if (!booted) {
			worker = spawn();
			worker.onmessage = (event) => receive(event.data);
			return worker;
		}

		worker = booted.worker;
		// Past whatever the script used, so a reply cannot resolve the wrong call.
		nextId = booted.id + 1;

		const tree = built(booted.comparison, awaitReply(booted.id));
		// Already in flight, so first in the lane. It may never be claimed, so
		// its failure is swallowed here.
		lane = tree.catch(() => {});
		adopted = { comparison: booted.comparison, tree };

		worker.onmessage = (event) => receive(event.data);
		for (const reply of booted.replies) {
			receive(reply as WorkerResponse);
		}

		return worker;
	}

	function send<T>(request: WorkerRequestInput): Promise<T> {
		const target = getWorker();
		const id = nextId++;
		const reply = awaitReply<T>(id);
		target.postMessage({ ...request, id } as WorkerRequest);
		return reply;
	}

	function enqueue<T>(request: () => Promise<T>): Promise<T> {
		// Adopting the boot's build is what puts it at the head of the lane.
		getWorker();
		const reply = lane.then(request);
		lane = reply.catch(() => {});
		return reply;
	}

	function built(
		comparison: Comparison,
		tree: Promise<DiffFileEntry>,
	): Promise<DiffFileEntry> {
		return tree.then(
			(value) => {
				active = comparisonKey(comparison);
				return value;
			},
			(error: unknown) => {
				active = null;
				throw error;
			},
		);
	}

	return {
		buildTree(comparison: Comparison): Promise<DiffFileEntry> {
			getWorker();

			const claim = adopted;
			// Claimed or overtaken, the boot's build stops being adoptable here.
			adopted = null;
			if (
				claim &&
				comparisonKey(claim.comparison) === comparisonKey(comparison)
			)
				return claim.tree;

			const build = ++buildsAsked;
			return enqueue(() => {
				if (build !== buildsAsked)
					return Promise.reject(
						new Error("Build overtaken by a newer comparison before it began"),
					);
				return built(comparison, send({ type: "build-tree", ...comparison }));
			});
		},

		getFile(
			comparison: Comparison,
			path: string,
			oldPath: string | undefined,
		): Promise<FileDiff> {
			const key = comparisonKey(comparison);
			return enqueue(() => {
				if (active !== key)
					return Promise.reject(
						new Error(`${path} was asked of a comparison no longer loaded`),
					);
				return send<FileDiff>({
					type: "get-file",
					path,
					oldPath,
					ignoreWhitespace: comparison.ignoreWhitespace,
				});
			});
		},

		// Not in the lane: it never touches the active diff.
		prefetch(request: DiffRequest): Promise<void> {
			return send<void>({ type: "prefetch", ...request });
		},
	};
}

export const diffClient = createDiffClient(
	() =>
		new Worker(new URL("./diff.worker.ts", import.meta.url), {
			type: "module",
		}),
);
