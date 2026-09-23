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

/**
 * The page's one link to the engine.
 *
 * A factory over how the worker is come by, because there are two ways: the
 * page spawns one, or it adopts the one the `<head>` boot script already
 * spawned and posted to. Which of those happened is not something the store
 * above should have to know, and it is exactly what a test needs to say.
 */
export function createDiffClient(
	spawn: () => Worker,
	boot: () => DiffBoot | null = readDiffBoot,
) {
	const pending = new Map<number, Pending>();
	let nextId = 0;
	let worker: Worker | null = null;
	/**
	 * The boot script's `build-tree`, waiting for whoever asked for it. Cleared
	 * the moment it is claimed *or* another comparison is asked for: the engine
	 * holds one active diff, so handing this tree back after a second
	 * `build-tree` has replaced it would describe a comparison no longer loaded.
	 */
	let adopted: { comparison: Comparison; tree: Promise<DiffFileEntry> } | null =
		null;
	/**
	 * The last of the requests that set or read the engine's active diff, which
	 * go one at a time, in the order they were asked for.
	 *
	 * The worker starts each message as it arrives, and a build replaces the
	 * active diff only when it *finishes*. Two builds in flight at once would
	 * leave the one that downloaded faster in the engine, not the one asked for
	 * last, and every read after that would come out of the wrong comparison.
	 */
	let lane: Promise<unknown> = Promise.resolve();
	/**
	 * The comparison the engine holds, by `comparisonKey`: the last build to
	 * succeed. `null` before one has, and after one fails, rather than guess
	 * what a failed build left behind.
	 */
	let active: string | null = null;
	/**
	 * How many builds have been asked for. One still waiting in the lane when
	 * a newer one is asked for is not worth sending: whatever it left in the
	 * engine, the newer one would replace before anything could read it.
	 */
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

	/**
	 * The WASM module keeps its extraction cache and its active-diff pointer in
	 * module-local state, so a second worker would silently start from an empty
	 * cache and fail every `getFile` with "No active diff context". One worker
	 * per document, and where the boot script made one, that is the one.
	 */
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
		// First in the lane, since it is already in flight. It may never be
		// claimed — a link opened and abandoned mid-flight — and an unclaimed
		// failure is not the page's to report.
		lane = tree.catch(() => {});
		adopted = { comparison: booted.comparison, tree };

		worker.onmessage = (event) => receive(event.data);
		// Everything the script's own handler caught while no client existed.
		for (const reply of booted.replies) {
			receive(reply as WorkerResponse);
		}

		return worker;
	}

	/**
	 * Requests carry an id because several may be in flight at once — a
	 * prefetch beside a build is the common case — and replies must resolve the
	 * call that asked for them rather than whichever is newest.
	 */
	function send<T>(request: WorkerRequestInput): Promise<T> {
		const target = getWorker();
		const id = nextId++;
		const reply = awaitReply<T>(id);
		target.postMessage({ ...request, id } as WorkerRequest);
		return reply;
	}

	/**
	 * Runs `request` once everything ahead of it in the lane has replied. A
	 * failure is its caller's to hear; whatever is behind it goes ahead anyway.
	 */
	function enqueue<T>(request: () => Promise<T>): Promise<T> {
		// Adopting the boot's build is what puts it at the head of the lane.
		getWorker();
		const reply = lane.then(request);
		lane = reply.catch(() => {});
		return reply;
	}

	/** A build's tree, with `active` kept in step with what it did to the engine. */
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
		/** Downloads both versions, extracts them, and returns the diff tree. */
		buildTree(comparison: Comparison): Promise<DiffFileEntry> {
			getWorker();

			const claim = adopted;
			// Either way the boot's request stops being adoptable here: claimed,
			// or overtaken by the comparison about to replace it in the engine.
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

		/**
		 * Reads one file's diff out of `comparison`, which `buildTree` must have
		 * built. The whitespace answer is the comparison's own, so the file and
		 * its tree cannot disagree about it.
		 *
		 * Refused once another comparison has replaced it in the engine: the
		 * engine would answer out of whichever diff it holds, and a diff of
		 * another pair of versions is not this file's.
		 */
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

		/**
		 * Warms the extraction cache so a later `buildTree` skips the downloads.
		 * Not in the lane: it leaves the active diff alone, so a build has no
		 * reason to wait for it, nor it for a build.
		 */
		prefetch(request: DiffRequest): Promise<void> {
			return send<void>({ type: "prefetch", ...request });
		},
	};
}

/**
 * One client per document, over the worker the boot script spawned where there
 * was a comparison to spawn it for.
 */
export const diffClient = createDiffClient(
	() =>
		new Worker(new URL("./diff.worker.ts", import.meta.url), {
			type: "module",
		}),
);
