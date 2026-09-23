import { describe, expect, test } from "bun:test";
import {
	type FolderAction,
	type FolderState,
	folderReducer,
	NO_FOLDERS_CHOSEN,
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

/** The folders once each of `actions` has happened, in order. */
function after(...actions: FolderAction[]): FolderState {
	return actions.reduce(folderReducer, NO_FOLDERS_CHOSEN);
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
			...folders,
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
});
