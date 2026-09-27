import { Store } from "@tanstack/react-store";
import type { DiffSlug } from "#/lib/url/slug.ts";
import { diffClient } from "#/lib/worker/diffWorkerClient.ts";
import {
	type Comparison,
	comparisonKey,
	type DiffFileEntry,
	type DiffRequest,
	type FileDiff,
} from "#/lib/worker/protocol.ts";
import { findFile } from "./tree.ts";

type DiffClient = Pick<typeof diffClient, "buildTree" | "getFile" | "prefetch">;

export type SessionStatus = "idle" | "loading" | "ready" | "error";

export interface OpenFile {
	path: string;
	status: "loading" | "ready" | "error";
	diff: FileDiff | null;
	error: string | null;
}

export interface DiffSessionState {
	/** The comparison on screen, as `comparisonKey` spells it; `null` when idle. */
	key: string | null;
	status: SessionStatus;
	tree: DiffFileEntry | null;
	error: string | null;
	/**
	 * The file the URL names, once its tree is ready to read it from; `null`
	 * until then, and when the URL names none.
	 */
	file: OpenFile | null;
}

const IDLE: DiffSessionState = {
	key: null,
	status: "idle",
	tree: null,
	error: null,
	file: null,
};

/** The download half of a request: what the engine needs to fetch, and no more. */
function archives(request: DiffRequest): DiffRequest {
	return {
		registry: request.registry,
		pkg: request.pkg,
		from: request.from,
		to: request.to,
	};
}

function message(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/**
 * The diff session: everything the engine produced for the comparison the URL
 * names. It is a store rather than component state because the worker outlives
 * any one route match — a version change re-renders the workspace, and the
 * reply to a request made before it must still find its way home.
 *
 * It is told two things, each whenever it changes: what the URL says, and the
 * answer to the whitespace question. They come in no fixed order — the stored
 * answer is only read once the page has mounted — so what to build, which file
 * to open and when are all worked out here, from whatever it has been told so
 * far. A file the URL names before its tree exists is remembered, and opened
 * once the tree is ready.
 *
 * A factory over the client so the store's own behaviour — ordering,
 * staleness, error surfacing, prefetch de-duplication — can be tested without
 * a browser; the real engine only runs in a worker (task 1).
 */
export function createDiffSession(client: DiffClient) {
	const store = new Store<DiffSessionState>(IDLE);
	const prefetched = new Set<string>();
	/** What the URL says, as last told; `null` until it has said anything. */
	let address: DiffSlug | null = null;
	/** Whether whitespace counts; `null` until the stored answer has been read. */
	let ignoreWhitespace: boolean | null = null;

	/** A reply is worth keeping only while its comparison is still the one asked for. */
	function isCurrent(key: string): boolean {
		return store.state.key === key;
	}

	/**
	 * The comparison to show, or `null` for none. Half a package name, or one
	 * version, is not a comparison yet — and nor is one whose whitespace
	 * question has no answer: starting on a guess would build every deep link's
	 * tree twice over when the stored answer turns out to be the other one.
	 */
	function wanted(): Comparison | null {
		if (!address || ignoreWhitespace === null) return null;
		const { registry, package: pkg, from, to } = address;
		if (!pkg || !from || !to) return null;

		return { registry, pkg, from, to, ignoreWhitespace };
	}

	/** Brings the store in line with everything the session has been told. */
	function settle(): void {
		const comparison = wanted();
		if (!comparison) {
			reset();
			return;
		}

		// Told again whenever either input changes, so the comparison already on
		// screen has to cost nothing — not two more archive downloads.
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
				error: message(error),
			}));
			return;
		}

		// Whichever file the URL names by now, which need not be the one it
		// named when the build began.
		await openNamedFile(comparison);
	}

	/**
	 * Warms the extraction cache for a comparison the user has not asked for
	 * yet, so hovering Compare pays for the downloads a click would.
	 *
	 * A guess, not a promise: it runs once per comparison and its failures are
	 * silent, because the click is where an error has somewhere to be shown.
	 */
	function prefetch(request: DiffRequest): void {
		// The archives alone: a prefetch warms downloads, and the same two serve
		// either answer to the whitespace question.
		const warming = archives(request);
		const key = comparisonKey({ ...warming, ignoreWhitespace: false });
		if (prefetched.has(key)) return;
		prefetched.add(key);
		client.prefetch(warming).catch(() => prefetched.delete(key));
	}

	/**
	 * Opens the file the URL names, read out of the comparison on screen.
	 * Cache-only in the engine, so it is cheap — but it can only run once
	 * `build` has left an active diff behind, which is why `build` comes back
	 * here when it has.
	 */
	async function openNamedFile(comparison: Comparison): Promise<void> {
		const path = address?.file ?? "";
		const { key, status, tree, file } = store.state;
		if (!path) {
			closeFile();
			return;
		}
		// No tree to find it in yet, or it is already the file open.
		if (!key || status !== "ready" || file?.path === path) return;

		const entry = findFile(tree, path);
		const open = (next: OpenFile) =>
			store.setState((state) => ({ ...state, file: next }));

		if (!entry) {
			open({
				path,
				status: "error",
				diff: null,
				error: `${path} is not in this comparison`,
			});
			return;
		}

		open({ path, status: "loading", diff: null, error: null });

		/** Both must still hold: the comparison, and the file within it. */
		const stillOpen = () => isCurrent(key) && store.state.file?.path === path;

		try {
			const diff = await client.getFile(comparison, entry.path, entry.oldPath);
			if (!stillOpen()) return;
			open({ path, status: "ready", diff, error: null });
		} catch (error) {
			if (!stillOpen()) return;
			open({ path, status: "error", diff: null, error: message(error) });
		}
	}

	/** The URL names no file, so whatever was open closes. */
	function closeFile(): void {
		if (store.state.file) store.setState((state) => ({ ...state, file: null }));
	}

	/** Back to nothing on screen: there is no comparison to build. */
	function reset(): void {
		if (store.state.key === null) return;
		store.setState(() => IDLE);
	}

	/**
	 * What the URL says: a comparison, where it names a whole one, and a file
	 * in it. The file is held until the tree it is in is ready.
	 */
	function follow(slug: DiffSlug): void {
		address = slug;
		settle();
	}

	/**
	 * The answer to the whitespace question: once the stored one has been read,
	 * and again whenever it changes. Nothing is built before it.
	 */
	function answerWhitespace(ignore: boolean): void {
		ignoreWhitespace = ignore;
		settle();
	}

	return { store, follow, answerWhitespace, prefetch };
}

/**
 * One session per document, matching the one worker per document the engine's
 * thread-local extraction cache requires (§2.6). Nothing writes to it on the
 * server — every entry point is an effect — so the module singleton cannot
 * leak one request's comparison into another's SSR render.
 */
export const diffSession = createDiffSession(diffClient);
