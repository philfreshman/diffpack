import { describe, expect, test } from "bun:test";
import {
	type FolderAction,
	type FolderState,
	folderReducer,
	foldersFor,
} from "#/lib/tree/folders.ts";
import { visibleRows } from "#/lib/tree/visibility.ts";
import type { DiffFileEntry } from "#/lib/worker/protocol.ts";

const open = (path: string): FolderAction => ({
	kind: "toggle",
	path,
	expanded: true,
});
const shut = (path: string): FolderAction => ({
	kind: "toggle",
	path,
	expanded: false,
});
const NARROW: FolderAction = { kind: "narrow" };
const reset = (comparison: string): FolderAction => ({
	kind: "reset",
	comparison,
});

const EXPRESS = "/npm/express/4.18.2/5.1.0";

/** The folders once each of `actions` has happened, in order. */
function after(...actions: FolderAction[]): FolderState {
	return actions.reduce(folderReducer, foldersFor(EXPRESS));
}

/** Both sets, spelled out, so an assertion reads as the state it expects. */
function chosen(folders: FolderState) {
	return {
		opened: [...folders.expandedKeys],
		shut: [...folders.collapsedKeys],
	};
}

describe("folderReducer", () => {
	test("starts with nothing chosen", () => {
		expect(chosen(after())).toEqual({ opened: [], shut: [] });
	});

	test("a folder opened by hand counts as opened", () => {
		expect(chosen(after(open("lib")))).toEqual({ opened: ["lib"], shut: [] });
	});

	test("a folder shut by hand counts as shut, and no longer as opened", () => {
		expect(chosen(after(open("lib"), shut("lib")))).toEqual({
			opened: [],
			shut: ["lib"],
		});
	});

	test("a toggle leaves the other folders as they were", () => {
		expect(chosen(after(open("lib"), shut("test"), open("docs")))).toEqual({
			opened: ["lib", "docs"],
			shut: ["test"],
		});
	});

	test("narrowing forgets the folders shut by hand, and keeps the ones opened", () => {
		// They were shut against a fuller tree: held shut, they would hide the
		// very rows the filter was typed to find.
		expect(chosen(after(open("lib"), shut("test"), NARROW))).toEqual({
			opened: ["lib"],
			shut: [],
		});
	});

	test("a new comparison starts with nothing chosen", () => {
		const folders = after(
			open("lib"),
			shut("test"),
			reset("/npm/express/5.1.0/5.2.0"),
		);

		expect(chosen(folders)).toEqual({ opened: [], shut: [] });
		expect(folders.comparison).toBe("/npm/express/5.1.0/5.2.0");
	});

	test("what is chosen stays with the comparison it was chosen in", () => {
		const folders = after(open("lib"), NARROW, shut("test"));

		expect(folders.comparison).toBe(EXPRESS);
	});

	test("leaves the state it is handed alone", () => {
		const before = after(open("lib"));

		folderReducer(before, shut("lib"));

		expect(chosen(before)).toEqual({ opened: ["lib"], shut: [] });
	});
});

describe("the folders chosen, as a tree that is one folder deep shows them", () => {
	const ONE_FOLDER: DiffFileEntry = {
		path: "",
		type: "directory",
		status: "modified",
		children: [
			{
				path: "src",
				type: "directory",
				status: "modified",
				children: [{ path: "src/index.js", type: "file", status: "modified" }],
			},
		],
	};

	const rows = (folders: FolderState) =>
		visibleRows(ONE_FOLDER, {
			filter: "",
			onlyModified: false,
			expandedKeys: folders.expandedKeys,
			collapsedKeys: folders.collapsedKeys,
		}).map((row) => row.entry.path);

	test("with nothing chosen, the only folder opens itself", () => {
		expect(rows(after())).toEqual(["src", "src/index.js"]);
	});

	test("shut by hand, the only folder stays shut", () => {
		expect(rows(after(shut("src")))).toEqual(["src"]);
	});

	test("opened again by hand, it opens", () => {
		expect(rows(after(shut("src"), open("src")))).toEqual([
			"src",
			"src/index.js",
		]);
	});

	test("narrowing lets an only folder shut by hand open itself again", () => {
		expect(rows(after(shut("src"), NARROW))).toEqual(["src", "src/index.js"]);
	});

	test("opening a folder inside the only folder leaves the only folder open", () => {
		const nested: DiffFileEntry = {
			...ONE_FOLDER,
			children: [
				{
					path: "src",
					type: "directory",
					status: "modified",
					children: [
						{
							path: "src/a",
							type: "directory",
							status: "modified",
							children: [
								{ path: "src/a/x.js", type: "file", status: "modified" },
							],
						},
					],
				},
			],
		};
		const folders = after(open("src/a"));

		const shown = visibleRows(nested, {
			filter: "",
			onlyModified: false,
			expandedKeys: folders.expandedKeys,
			collapsedKeys: folders.collapsedKeys,
		}).map((row) => row.entry.path);

		expect(shown).toEqual(["src", "src/a", "src/a/x.js"]);
	});

	test("a new comparison opens its only folder, whatever the last one chose", () => {
		// The last comparison had `lib` to open and its own `src` to shut; this
		// one is `src` alone, and what was chosen there says nothing about it.
		const folders = after(
			open("lib"),
			shut("src"),
			reset("/npm/one/2.0.0/3.0.0"),
		);

		expect(rows(folders)).toEqual(["src", "src/index.js"]);
	});
});
