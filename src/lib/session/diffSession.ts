import { Store } from "@tanstack/react-store";
import { cachedDiffClient } from "#/lib/cache/cachedDiffClient.ts";
import { type FailureCode, failureOf } from "#/lib/failure/failure.ts";
import type { DiffSlug } from "#/lib/url/slug.ts";
import type { DiffClient } from "#/lib/worker/diffWorkerClient.ts";
import {
	type Comparison,
	comparisonKey,
	type DiffFileEntry,
	type DiffRequest,
	type FileDiff,
} from "#/lib/worker/protocol.ts";
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

// A store, not component state: replies must outlive any one route match.
export function createDiffSession(client: DiffClient) {
	const store = new Store<DiffSessionState>(IDLE);
	const prefetched = new Set<string>();
	let address: DiffSlug | null = null;
	/** `null` until the stored answer has been read. */
	let ignoreWhitespace: boolean | null = null;

	function isCurrent(key: string): boolean {
		return store.state.key === key;
	}

	// Nothing until the whitespace answer is known: guessing would build a deep
	// link's tree twice when the stored answer is the other one.
	function wanted(): Comparison | null {
		if (!address || ignoreWhitespace === null) return null;
		const { registry, package: pkg, from, to } = address;
		if (!pkg || !from || !to) return null;

		return { registry, pkg, from, to, ignoreWhitespace };
	}

	function settle(): void {
		const comparison = wanted();
		if (!comparison) {
			reset();
			return;
		}

		// Told again on every input change, so the comparison on screen must cost
		// nothing.
		if (isCurrent(comparisonKey(comparison))) void openNamedFile(comparison);
		else void build(comparison);
	}

	async function build(comparison: Comparison): Promise<void> {
		const key = comparisonKey(comparison);
		store.setState(() => ({ ...IDLE, key, status: "loading" }));

		try {
			const tree = await client.buildTree(comparison);
			if (!isCurrent(key)) return;
			store.setState((state) => ({ ...state, status: "ready", tree }));
		} catch (error) {
			if (!isCurrent(key)) return;
			store.setState((state) => ({
				...state,
				status: "error",
				...shownFailure(error),
			}));
			return;
		}

		// The file the URL names now, not when the build began.
		await openNamedFile(comparison);
	}

	// Failures are silent: the click that follows is where an error is shown.
	function prefetch(request: DiffRequest): void {
		// The same downloads serve either whitespace answer.
		const warming = archives(request);
		const key = comparisonKey({ ...warming, ignoreWhitespace: false });
		if (prefetched.has(key)) return;
		prefetched.add(key);
		client.prefetch(warming).catch(() => prefetched.delete(key));
	}

	// Needs the active diff `build` leaves behind, so `build` calls it when done.
	async function openNamedFile(comparison: Comparison): Promise<void> {
		const path = address?.file ?? "";
		const { key, status, tree, file } = store.state;
		if (!path) {
			closeFile();
			return;
		}
		if (!key || status !== "ready" || file?.path === path) return;

		const entry = findFile(tree, path);
		const open = (next: OpenFile) =>
			store.setState((state) => ({ ...state, file: next }));

		if (!entry) {
			open({
				path,
				status: "error",
				diff: null,
				...NO_FAILURE,
				error: `${path} is not in this comparison`,
			});
			return;
		}

		open({ path, status: "loading", diff: null, ...NO_FAILURE });

		const stillOpen = () => isCurrent(key) && store.state.file?.path === path;

		try {
			const diff = await client.getFile(comparison, entry.path, entry.oldPath);
			if (!stillOpen()) return;
			open({ path, status: "ready", diff, ...NO_FAILURE });
		} catch (error) {
			if (!stillOpen()) return;
			open({ path, status: "error", diff: null, ...shownFailure(error) });
		}
	}

	function closeFile(): void {
		if (store.state.file) store.setState((state) => ({ ...state, file: null }));
	}

	function reset(): void {
		if (store.state.key === null) return;
		store.setState(() => IDLE);
	}

	function follow(slug: DiffSlug): void {
		address = slug;
		settle();
	}

	function answerWhitespace(ignore: boolean): void {
		ignoreWhitespace = ignore;
		settle();
	}

	return { store, follow, answerWhitespace, prefetch };
}

// Only effects write to it, so on the server it cannot leak between SSR renders.
export const diffSession = createDiffSession(cachedDiffClient);
