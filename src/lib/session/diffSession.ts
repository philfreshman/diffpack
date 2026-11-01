import { Store } from "@tanstack/react-store";
import { cachedDiffClient } from "#/lib/cache/cachedDiffClient.ts";
import { type FailureCode, failureOf } from "#/lib/failure/failure.ts";
import type { DiffSlug } from "#/lib/url/slug.ts";
import type { DiffClient } from "#/lib/worker/diffWorkerClient.ts";
import {
	type ArchiveFetched,
	type Comparison,
	comparisonKey,
	type DiffFileEntry,
	type DiffRequest,
	type FileDiff,
} from "#/lib/worker/protocol.ts";
import {
	archiveFetched,
	type BuildProgress,
	buildFailed,
	FETCHING,
} from "./buildProgress.ts";
import { findFile } from "./tree.ts";

export type SessionStatus = "idle" | "loading" | "ready" | "error";

interface ShownFailure {
	error: string | null;
	errorCode: FailureCode | null;
	resetsAt: string | null;
}

export interface OpenFile extends ShownFailure {
	path: string;
	status: "loading" | "ready" | "error";
	diff: FileDiff | null;
}

export interface DiffSessionState extends ShownFailure {
	key: string | null;
	status: SessionStatus;
	tree: DiffFileEntry | null;
	progress: BuildProgress | null;
	/** `null` until the tree is ready to read the URL's file from. */
	file: OpenFile | null;
}

const NO_FAILURE: ShownFailure = {
	error: null,
	errorCode: null,
	resetsAt: null,
};

const IDLE: DiffSessionState = {
	key: null,
	status: "idle",
	tree: null,
	progress: null,
	...NO_FAILURE,
	file: null,
};

function archives(request: DiffRequest): DiffRequest {
	return {
		registry: request.registry,
		pkg: request.pkg,
		from: request.from,
		to: request.to,
	};
}

function shownFailure(error: unknown): ShownFailure {
	const { message, code, resetsAt } = failureOf(error);
	return {
		error: message,
		errorCode: code ?? null,
		resetsAt: resetsAt ?? null,
	};
}

type SessionStore = Store<DiffSessionState>;

interface Session {
	store: SessionStore;
	client: DiffClient;
	namedPath: () => string;
}

// Nothing until the whitespace answer is known: guessing would build a deep
// link's tree twice when the stored answer is the other one.
function comparisonOf(
	address: DiffSlug | null,
	ignoreWhitespace: boolean | null,
): Comparison | null {
	if (!address || ignoreWhitespace === null) return null;
	const { registry, package: pkg, from, to } = address;
	if (!pkg || !from || !to) return null;

	return { registry, pkg, from, to, ignoreWhitespace };
}

function isCurrent(store: SessionStore, key: string): boolean {
	return store.state.key === key;
}

function updateProgress(
	store: SessionStore,
	change: (progress: BuildProgress) => BuildProgress,
): void {
	store.setState((state) => ({
		...state,
		progress: state.progress && change(state.progress),
	}));
}

function showFile(store: SessionStore, next: OpenFile): void {
	store.setState((state) => ({ ...state, file: next }));
}

function closeFile(store: SessionStore): void {
	if (store.state.file) store.setState((state) => ({ ...state, file: null }));
}

function reset(store: SessionStore): void {
	if (store.state.key === null) return;
	store.setState(() => IDLE);
}

async function build(session: Session, comparison: Comparison): Promise<void> {
	const { store, client } = session;
	const key = comparisonKey(comparison);
	store.setState(() => ({
		...IDLE,
		key,
		status: "loading",
		progress: FETCHING,
	}));

	const report = (fetched: ArchiveFetched) => {
		if (isCurrent(store, key))
			updateProgress(store, (progress) => archiveFetched(progress, fetched));
	};

	try {
		const tree = await client.buildTree(comparison, report);
		if (!isCurrent(store, key)) return;
		store.setState((state) => ({ ...state, status: "ready", tree }));
	} catch (error) {
		if (!isCurrent(store, key)) return;
		store.setState((state) => ({
			...state,
			status: "error",
			...shownFailure(error),
		}));
		updateProgress(store, (progress) =>
			buildFailed(progress, failureOf(error)),
		);
		return;
	}

	// The file the URL names now, not when the build began.
	await openNamedFile(session, comparison);
}

// Needs the active diff `build` leaves behind, so `build` calls it when done.
async function openNamedFile(
	{ store, client, namedPath }: Session,
	comparison: Comparison,
): Promise<void> {
	const path = namedPath();
	const { key, status, tree, file } = store.state;
	if (!path) {
		closeFile(store);
		return;
	}
	if (!key || status !== "ready" || file?.path === path) return;

	const entry = findFile(tree, path);
	if (!entry) {
		showFile(store, {
			path,
			status: "error",
			diff: null,
			...NO_FAILURE,
			error: `${path} is not in this comparison`,
		});
		return;
	}

	showFile(store, { path, status: "loading", diff: null, ...NO_FAILURE });

	const stillOpen = () =>
		isCurrent(store, key) && store.state.file?.path === path;

	try {
		const diff = await client.getFile(comparison, entry.path, entry.oldPath);
		if (!stillOpen()) return;
		showFile(store, { path, status: "ready", diff, ...NO_FAILURE });
	} catch (error) {
		if (!stillOpen()) return;
		showFile(store, {
			path,
			status: "error",
			diff: null,
			...shownFailure(error),
		});
	}
}

function createPrefetcher(client: DiffClient) {
	const prefetched = new Set<string>();

	// Failures are silent: the click that follows is where an error is shown.
	return function prefetch(request: DiffRequest): void {
		// The same downloads serve either whitespace answer.
		const warming = archives(request);
		const key = comparisonKey({ ...warming, ignoreWhitespace: false });
		if (prefetched.has(key)) return;
		prefetched.add(key);
		client.prefetch(warming).catch(() => prefetched.delete(key));
	};
}

// A store, not component state: replies must outlive any one route match.
export function createDiffSession(client: DiffClient) {
	const store = new Store<DiffSessionState>(IDLE);
	const prefetch = createPrefetcher(client);
	let address: DiffSlug | null = null;
	/** `null` until the stored answer has been read. */
	let ignoreWhitespace: boolean | null = null;
	const session: Session = {
		store,
		client,
		namedPath: () => address?.file ?? "",
	};

	function wanted(): Comparison | null {
		return comparisonOf(address, ignoreWhitespace);
	}

	function settle(): void {
		const comparison = wanted();
		if (!comparison) {
			reset(store);
			return;
		}

		// Told again on every input change, so the comparison on screen must cost
		// nothing.
		if (isCurrent(store, comparisonKey(comparison)))
			void openNamedFile(session, comparison);
		else void build(session, comparison);
	}

	async function readFile(entry: DiffFileEntry): Promise<FileDiff> {
		const comparison = wanted();
		const ready =
			comparison !== null &&
			isCurrent(store, comparisonKey(comparison)) &&
			store.state.status === "ready";
		if (!ready) throw new Error(`${entry.path} is not in this comparison`);

		return client.getFile(comparison, entry.path, entry.oldPath);
	}

	function follow(slug: DiffSlug): void {
		address = slug;
		settle();
	}

	function answerWhitespace(ignore: boolean): void {
		ignoreWhitespace = ignore;
		settle();
	}

	return { store, follow, answerWhitespace, prefetch, readFile };
}

// Only effects write to it, so on the server it cannot leak between SSR renders.
export const diffSession = createDiffSession(cachedDiffClient);
