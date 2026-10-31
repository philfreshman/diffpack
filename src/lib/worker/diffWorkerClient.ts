import { CodedError } from "#/lib/failure/failure.ts";
import { type DiffBoot, readDiffBoot } from "./bootScript.ts";
import {
	type ArchiveFetched,
	type Comparison,
	comparisonKey,
	type DiffFileEntry,
	type DiffRequest,
	type FileDiff,
	isProgress,
	type OnArchiveFetched,
	type WorkerMessage,
	type WorkerRequest,
	type WorkerRequestInput,
} from "./protocol.ts";

type Pending = {
	resolve: (value: unknown) => void;
	reject: (reason: Error) => void;
	onProgress?: OnArchiveFetched;
};

const ignoreProgress: OnArchiveFetched = () => {};

function createProgressRelay() {
	const heard: ArchiveFetched[] = [];
	let listener: OnArchiveFetched | null = null;

	return {
		tell(fetched: ArchiveFetched) {
			if (listener) listener(fetched);
			else heard.push(fetched);
		},
		listen(next: OnArchiveFetched) {
			listener = next;
			for (const fetched of heard.splice(0)) next(fetched);
		},
	};
}

type ProgressRelay = ReturnType<typeof createProgressRelay>;

function createReplies() {
	const pending = new Map<number, Pending>();

	return {
		receive(message: WorkerMessage): void {
			const entry = pending.get(message.id);
			if (!entry) return;
			if (isProgress(message)) {
				entry.onProgress?.(message.fetched);
				return;
			}
			pending.delete(message.id);
			if (message.ok) entry.resolve(message.data);
			else entry.reject(new CodedError({ ...message, message: message.error }));
		},

		awaitReply<T>(id: number, onProgress?: OnArchiveFetched): Promise<T> {
			return new Promise<T>((resolve, reject) => {
				pending.set(id, {
					resolve: resolve as (value: unknown) => void,
					reject,
					onProgress,
				});
			});
		},
	};
}

type BootBuild = {
	comparison: Comparison;
	reply: Promise<DiffFileEntry>;
	progress: ProgressRelay;
};

function createTransport(
	spawn: () => Worker,
	boot: () => DiffBoot | null,
	adoptBootBuild: (build: BootBuild) => void,
) {
	const replies = createReplies();
	let nextId = 0;
	let worker: Worker | null = null;

	function listen(target: Worker): void {
		target.onmessage = (event) => replies.receive(event.data);
	}

	function takeOver(booted: DiffBoot): void {
		// Past whatever the script used, so a reply cannot resolve the wrong call.
		nextId = booted.id + 1;

		const progress = createProgressRelay();
		const reply = replies.awaitReply<DiffFileEntry>(booted.id, progress.tell);
		adoptBootBuild({ comparison: booted.comparison, reply, progress });

		listen(booted.worker);
		for (const message of booted.replies) {
			replies.receive(message as WorkerMessage);
		}
	}

	// One worker per document: a second would start with an empty wasm cache and
	// fail every `getFile` with "No active diff context".
	function connect(): Worker {
		if (worker) return worker;

		const booted = boot();
		if (!booted) {
			worker = spawn();
			listen(worker);
			return worker;
		}

		worker = booted.worker;
		takeOver(booted);
		return worker;
	}

	function send<T>(
		request: WorkerRequestInput,
		onProgress?: OnArchiveFetched,
	): Promise<T> {
		const target = connect();
		const id = nextId++;
		const reply = replies.awaitReply<T>(id, onProgress);
		target.postMessage({ ...request, id } as WorkerRequest);
		return reply;
	}

	return { connect, send };
}

type Transport = ReturnType<typeof createTransport>;

// Builds and reads run one at a time. A download that never finishes stalls
// everything behind it: the engine cannot cancel a build.
function createLane() {
	let tail: Promise<unknown> = Promise.resolve();

	return {
		startWith(inFlight: Promise<unknown>): void {
			tail = inFlight.catch(() => {});
		},

		join<T>(request: () => Promise<T>): Promise<T> {
			const reply = tail.then(request);
			tail = reply.catch(() => {});
			return reply;
		},
	};
}

type Lane = ReturnType<typeof createLane>;

function createActiveDiff() {
	// `null` after a failed build, rather than guess what it left behind.
	let active: string | null = null;

	return {
		holds(key: string): boolean {
			return active === key;
		},

		track(
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
		},
	};
}

type ActiveDiff = ReturnType<typeof createActiveDiff>;

type AdoptedBuild = {
	comparison: Comparison;
	tree: Promise<DiffFileEntry>;
	progress: ProgressRelay;
};

function createAdoption() {
	// Cleared once claimed *or* once another comparison is asked for: after a
	// second `build-tree` this tree would describe a diff no longer loaded.
	let adopted: AdoptedBuild | null = null;

	return {
		offer(build: AdoptedBuild): void {
			adopted = build;
		},

		claim(
			comparison: Comparison,
			onProgress: OnArchiveFetched,
		): Promise<DiffFileEntry> | null {
			const claim = adopted;
			// Claimed or overtaken, the boot's build stops being adoptable here.
			adopted = null;
			if (
				!claim ||
				comparisonKey(claim.comparison) !== comparisonKey(comparison)
			)
				return null;

			claim.progress.listen(onProgress);
			return claim.tree;
		},
	};
}

interface SerialWorker {
	transport: Transport;
	lane: Lane;
	active: ActiveDiff;
}

function enqueue<T>(
	{ transport, lane }: SerialWorker,
	request: () => Promise<T>,
): Promise<T> {
	// Adopting the boot's build is what puts it at the head of the lane.
	transport.connect();
	return lane.join(request);
}

function readFile(
	serialWorker: SerialWorker,
	comparison: Comparison,
	path: string,
	oldPath: string | undefined,
): Promise<FileDiff> {
	const key = comparisonKey(comparison);
	return enqueue(serialWorker, () => {
		if (!serialWorker.active.holds(key))
			return Promise.reject(
				new Error(`${path} was asked of a comparison no longer loaded`),
			);
		return serialWorker.transport.send<FileDiff>({
			type: "get-file",
			path,
			oldPath,
			ignoreWhitespace: comparison.ignoreWhitespace,
		});
	});
}

export function createDiffClient(
	spawn: () => Worker,
	boot: () => DiffBoot | null = readDiffBoot,
) {
	const lane = createLane();
	const active = createActiveDiff();
	const adoption = createAdoption();
	const transport = createTransport(spawn, boot, (build) => {
		const tree = active.track(build.comparison, build.reply);
		// Already in flight, so first in the lane. It may never be claimed, so
		// its failure is swallowed here.
		lane.startWith(tree);
		adoption.offer({
			comparison: build.comparison,
			tree,
			progress: build.progress,
		});
	});
	const serialWorker: SerialWorker = { transport, lane, active };
	let buildsAsked = 0;

	return {
		buildTree(
			comparison: Comparison,
			onProgress: OnArchiveFetched = ignoreProgress,
		): Promise<DiffFileEntry> {
			transport.connect();

			const claimed = adoption.claim(comparison, onProgress);
			if (claimed) return claimed;

			const build = ++buildsAsked;
			return enqueue(serialWorker, () => {
				if (build !== buildsAsked)
					return Promise.reject(
						new Error("Build overtaken by a newer comparison before it began"),
					);
				return active.track(
					comparison,
					transport.send({ type: "build-tree", ...comparison }, onProgress),
				);
			});
		},

		getFile(
			comparison: Comparison,
			path: string,
			oldPath: string | undefined,
		): Promise<FileDiff> {
			return readFile(serialWorker, comparison, path, oldPath);
		},

		// Not in the lane: it never touches the active diff.
		prefetch(request: DiffRequest): Promise<void> {
			return transport.send<void>({ type: "prefetch", ...request });
		},
	};
}

export type DiffClient = Pick<
	ReturnType<typeof createDiffClient>,
	"buildTree" | "getFile" | "prefetch"
>;

export const diffClient = createDiffClient(
	() =>
		new Worker(new URL("./diff.worker.ts", import.meta.url), {
			type: "module",
		}),
);
