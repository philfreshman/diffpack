import { describe, expect, test } from "bun:test";
import { createDiffSession } from "#/lib/session/diffSession.ts";
import type { DiffSlug } from "#/lib/url/slug.ts";
import type {
	Comparison,
	DiffFileEntry,
	DiffRequest,
	FileDiff,
} from "#/lib/worker/protocol.ts";

/** What the URL says for a comparison, with no file in it. */
const SLUG: DiffSlug = {
	registry: "npm",
	package: "express",
	from: "4.18.2",
	to: "5.1.0",
	file: "",
};

/** What the engine is asked to build for `SLUG`, whitespace-exact. */
const COMPARISON: Comparison = {
	registry: "npm",
	pkg: "express",
	from: "4.18.2",
	to: "5.1.0",
	ignoreWhitespace: false,
};

const TREE: DiffFileEntry = {
	path: "",
	type: "directory",
	status: "modified",
	children: [
		{ path: "index.js", type: "file", status: "modified" },
		{
			path: "lib/router.js",
			oldPath: "lib/routes.js",
			type: "file",
			status: "renamed",
		},
	],
};

/** A promise plus the handles to settle it from the test. */
function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: Error) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});

	return { promise, resolve, reject };
}

/**
 * Stands in for the worker client. It records what it was asked for and hands
 * back promises the test settles by hand, which is the only way to be inside
 * an in-flight request when the next one arrives.
 */
function stubClient() {
	const built: Comparison[] = [];
	const trees: Array<ReturnType<typeof deferred<DiffFileEntry>>> = [];
	const filesAsked: Array<[Comparison, string, string | undefined]> = [];
	const fileReplies: Array<ReturnType<typeof deferred<FileDiff>>> = [];
	const prefetched: DiffRequest[] = [];
	let prefetchFails = false;

	return {
		built,
		trees,
		filesAsked,
		fileReplies,
		prefetched,
		failPrefetch() {
			prefetchFails = true;
		},
		client: {
			buildTree(comparison: Comparison) {
				built.push(comparison);
				const next = deferred<DiffFileEntry>();
				trees.push(next);
				return next.promise;
			},
			getFile(
				comparison: Comparison,
				path: string,
				oldPath: string | undefined,
			) {
				filesAsked.push([comparison, path, oldPath]);
				const next = deferred<FileDiff>();
				fileReplies.push(next);
				return next.promise;
			},
			prefetch(request: DiffRequest) {
				prefetched.push(request);
				return prefetchFails
					? Promise.reject(new Error("offline"))
					: Promise.resolve();
			},
		},
	};
}

/** The nth request the stub is holding open, or a clear failure if there is none. */
function take<T>(list: T[], index: number): T {
	const pending = list[index];
	if (!pending) throw new Error(`no request in flight at ${index}`);

	return pending;
}

/** Lets the microtask queue drain, so a settled promise has been observed. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A session told what the URL says, then the whitespace answer. */
function toldOf(slug: DiffSlug, ignoreWhitespace = false) {
	const stub = stubClient();
	const session = createDiffSession(stub.client);
	session.follow(slug);
	session.answerWhitespace(ignoreWhitespace);

	return { stub, session };
}

/** A session whose tree for `SLUG` has arrived. */
async function readySession() {
	const told = toldOf(SLUG);
	take(told.stub.trees, 0).resolve(TREE);
	await settled();

	return told;
}

describe("a comparison", () => {
	test("goes loading, then ready with the tree", async () => {
		const { stub, session } = toldOf(SLUG);

		expect(stub.built).toEqual([COMPARISON]);
		expect(session.store.state.status).toBe("loading");

		take(stub.trees, 0).resolve(TREE);
		await settled();

		expect(session.store.state.status).toBe("ready");
		expect(session.store.state.tree).toBe(TREE);
	});

	test("asking again for the comparison on screen costs nothing", async () => {
		// The workspace re-renders on every keystroke in the header; being told
		// the same pair again must not re-download two archives.
		const { stub, session } = await readySession();

		session.follow({ ...SLUG });
		session.answerWhitespace(false);

		expect(stub.built).toHaveLength(1);
	});

	test("surfaces the engine's own message when it fails", async () => {
		const { stub, session } = toldOf(SLUG);

		take(stub.trees, 0).reject(new Error("404 fetching express@5.1.0"));
		await settled();

		expect(session.store.state.status).toBe("error");
		expect(session.store.state.error).toBe("404 fetching express@5.1.0");
	});

	test("a superseded comparison never lands", async () => {
		const { stub, session } = toldOf(SLUG);
		session.follow({ ...SLUG, to: "5.2.0" });

		// The first archive finishes downloading after the user has moved on.
		take(stub.trees, 0).resolve(TREE);
		take(stub.trees, 1).resolve({ ...TREE, path: "second" });
		await settled();

		expect(session.store.state.tree?.path).toBe("second");
	});

	test("a superseded failure does not replace a live comparison", async () => {
		const { stub, session } = toldOf(SLUG);
		session.follow({ ...SLUG, to: "5.2.0" });

		take(stub.trees, 1).resolve(TREE);
		take(stub.trees, 0).reject(new Error("404"));
		await settled();

		expect(session.store.state.status).toBe("ready");
		expect(session.store.state.error).toBeNull();
	});
});

type Session = ReturnType<typeof createDiffSession>;

/**
 * The two things a session is told, in each order they can come in. The
 * stored whitespace answer is read once the page has mounted, and nothing
 * says whether that lands before or after the URL is first passed on.
 */
const ORDERS: Array<[string, (session: Session, slug: DiffSlug) => void]> = [
	[
		"the URL first",
		(session, slug) => {
			session.follow(slug);
			session.answerWhitespace(false);
		},
	],
	[
		"the whitespace answer first",
		(session, slug) => {
			session.answerWhitespace(false);
			session.follow(slug);
		},
	],
];

describe.each(ORDERS)("told %s", (_, tell) => {
	function told(slug: DiffSlug) {
		const stub = stubClient();
		const session = createDiffSession(stub.client);
		tell(session, slug);

		return { stub, session };
	}

	test("a file named before the tree is ready opens once it is ready", async () => {
		const { stub, session } = told({ ...SLUG, file: "index.js" });

		// Nothing to read it out of yet, and nothing for the page to show.
		expect(stub.filesAsked).toEqual([]);
		expect(session.store.state.file).toBeNull();

		take(stub.trees, 0).resolve(TREE);
		await settled();

		expect(stub.filesAsked).toEqual([[COMPARISON, "index.js", undefined]]);
		expect(session.store.state.file).toMatchObject({
			path: "index.js",
			status: "loading",
		});
	});

	test("a file from a replaced comparison never opens", async () => {
		const { stub, session } = told({ ...SLUG, file: "index.js" });
		// Another pair, naming no file, before the first tree has arrived.
		session.follow({ ...SLUG, to: "5.2.0" });

		// The replaced tree lands while the new one is still on its way.
		take(stub.trees, 0).resolve(TREE);
		await settled();
		expect(session.store.state.status).toBe("loading");

		// The new tree holds a file of the same name, so only the URL can say
		// that it was not asked for.
		take(stub.trees, 1).resolve(TREE);
		await settled();

		expect(stub.filesAsked).toEqual([]);
		expect(session.store.state.file).toBeNull();
	});

	test("changing only the file does not rebuild the tree", async () => {
		const { stub, session } = told(SLUG);
		// Once while the tree is on its way, once after it has arrived.
		session.follow({ ...SLUG, file: "index.js" });
		take(stub.trees, 0).resolve(TREE);
		await settled();
		session.follow({ ...SLUG, file: "lib/router.js" });

		expect(stub.built).toHaveLength(1);
		expect(stub.filesAsked.map(([, path]) => path)).toEqual([
			"index.js",
			"lib/router.js",
		]);
	});
});

test("a whitespace answer arriving late starts exactly one build", () => {
	// A deep link, then a click into a file, all before the stored answer has
	// been read: not one build on a guess and another on the answer.
	const stub = stubClient();
	const session = createDiffSession(stub.client);
	session.follow(SLUG);
	session.follow({ ...SLUG, file: "index.js" });

	expect(stub.built).toEqual([]);
	expect(session.store.state.status).toBe("idle");

	session.answerWhitespace(true);

	expect(stub.built).toEqual([{ ...COMPARISON, ignoreWhitespace: true }]);
	expect(session.store.state.status).toBe("loading");
});

describe("ignoring whitespace", () => {
	test("is a different comparison, so the tree is built again", async () => {
		// Not a repaint of the tree on screen: which lines differ is the
		// engine's answer, and the engine has to be asked the other question.
		const { stub, session } = await readySession();

		session.answerWhitespace(true);

		expect(stub.built).toEqual([
			COMPARISON,
			{ ...COMPARISON, ignoreWhitespace: true },
		]);
		expect(session.store.state.status).toBe("loading");
	});

	test("is not part of a prefetch, which only warms the downloads", () => {
		// One prefetch per pair of archives, whatever the setting says — the
		// flag has no bearing on what is downloaded or extracted.
		const stub = stubClient();
		const session = createDiffSession(stub.client);

		const ignoring: Comparison = { ...COMPARISON, ignoreWhitespace: true };
		session.prefetch(COMPARISON);
		session.prefetch(ignoring);

		expect(stub.prefetched).toHaveLength(1);
		expect(stub.prefetched[0]).not.toHaveProperty("ignoreWhitespace");
	});

	test("reaches the engine when a file is read", async () => {
		const { stub } = toldOf({ ...SLUG, file: "index.js" }, true);

		take(stub.trees, 0).resolve(TREE);
		await settled();

		expect(stub.filesAsked[0]).toEqual([
			{ ...COMPARISON, ignoreWhitespace: true },
			"index.js",
			undefined,
		]);
	});

	test("changed mid-read, the old answer's reply never lands", async () => {
		// The rebuilt tree has the same paths, so the same file is read again.
		// The first reply, arriving last, answers the question no longer asked.
		const { stub, session } = await readySession();
		session.follow({ ...SLUG, file: "index.js" });
		session.answerWhitespace(true);
		take(stub.trees, 1).resolve(TREE);
		await settled();

		take(stub.fileReplies, 1).resolve({ data: "ignoring", isDiff: true });
		take(stub.fileReplies, 0).resolve({ data: "exact", isDiff: true });
		await settled();

		expect(session.store.state.file).toMatchObject({
			path: "index.js",
			diff: { data: "ignoring", isDiff: true },
		});
	});
});

describe("the file the URL names", () => {
	test("is read out of the comparison on screen", async () => {
		const { stub, session } = await readySession();

		session.follow({ ...SLUG, file: "index.js" });
		expect(session.store.state.file).toMatchObject({
			path: "index.js",
			status: "loading",
		});

		take(stub.fileReplies, 0).resolve({ data: "@@", isDiff: true });
		await settled();

		expect(session.store.state.file).toMatchObject({
			path: "index.js",
			status: "ready",
		});
	});

	test("is asked for under both of its paths when it was renamed", async () => {
		const { stub, session } = await readySession();

		session.follow({ ...SLUG, file: "lib/router.js" });

		expect(stub.filesAsked[0]).toEqual([
			COMPARISON,
			"lib/router.js",
			"lib/routes.js",
		]);
	});

	test("is not read again when the URL is told again", async () => {
		// A remount or a repeated effect tells the session what it already
		// knows; the file on screen must not drop back to loading for it.
		const { stub, session } = await readySession();
		session.follow({ ...SLUG, file: "index.js" });
		take(stub.fileReplies, 0).resolve({ data: "@@", isDiff: true });
		await settled();

		session.follow({ ...SLUG, file: "index.js" });
		session.answerWhitespace(false);

		expect(stub.filesAsked).toHaveLength(1);
		expect(session.store.state.file).toMatchObject({
			path: "index.js",
			status: "ready",
		});
	});

	test("closes when the URL stops naming it", async () => {
		const { stub, session } = await readySession();
		session.follow({ ...SLUG, file: "index.js" });
		take(stub.fileReplies, 0).resolve({ data: "@@", isDiff: true });
		await settled();

		session.follow(SLUG);

		expect(session.store.state.file).toBeNull();
	});

	test("is an error when this comparison does not contain it", async () => {
		// A deep link into a pair where the file no longer exists: it has to say
		// so, not spin forever waiting for the engine.
		const { stub, session } = await readySession();

		session.follow({ ...SLUG, file: "gone.js" });

		expect(session.store.state.file).toMatchObject({
			path: "gone.js",
			status: "error",
		});
		expect(stub.filesAsked).toHaveLength(0);
	});

	test("on screen is the one the URL named last", async () => {
		const { stub, session } = await readySession();

		session.follow({ ...SLUG, file: "index.js" });
		session.follow({ ...SLUG, file: "lib/router.js" });
		// Clicking through the tree quickly: the first reply arrives last.
		take(stub.fileReplies, 1).resolve({ data: "second", isDiff: true });
		take(stub.fileReplies, 0).resolve({ data: "first", isDiff: true });
		await settled();

		expect(session.store.state.file).toMatchObject({
			path: "lib/router.js",
			diff: { data: "second", isDiff: true },
		});
	});
});

describe("prefetch", () => {
	test("warms a comparison once, however often it is hovered", () => {
		const stub = stubClient();
		const session = createDiffSession(stub.client);

		session.prefetch(COMPARISON);
		session.prefetch({ ...COMPARISON });
		session.prefetch({ ...COMPARISON, to: "5.2.0" });

		expect(stub.prefetched).toHaveLength(2);
	});

	test("a failed guess is silent, and can be tried again", async () => {
		const stub = stubClient();
		stub.failPrefetch();
		const session = createDiffSession(stub.client);

		session.prefetch(COMPARISON);
		await settled();
		session.prefetch(COMPARISON);

		expect(stub.prefetched).toHaveLength(2);
		expect(session.store.state.status).toBe("idle");
	});
});

describe("a URL that names no comparison", () => {
	test("clears the one on screen", async () => {
		const { session } = await readySession();

		session.follow({ ...SLUG, from: "", to: "" });

		expect(session.store.state).toMatchObject({
			key: null,
			status: "idle",
			tree: null,
			file: null,
		});
	});

	test("starts nothing: half a package name or one version is not a comparison", () => {
		for (const half of [
			{ ...SLUG, package: "" },
			{ ...SLUG, from: "" },
			{ ...SLUG, to: "" },
		]) {
			const { stub, session } = toldOf(half);

			expect(stub.built).toEqual([]);
			expect(session.store.state.status).toBe("idle");
		}
	});
});
