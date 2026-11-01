import { describe, expect, test } from "bun:test";
import { rowKey, visibleRows } from "#/lib/tree/visibility.ts";
import type { DiffFileEntry } from "#/lib/worker/protocol.ts";

function file(path: string, status: DiffFileEntry["status"]): DiffFileEntry {
	return { path, type: "file", status };
}

function directory(
	path: string,
	status: DiffFileEntry["status"],
	children: DiffFileEntry[],
): DiffFileEntry {
	return { path, type: "directory", status, children };
}

const NESTED: DiffFileEntry = {
	path: "",
	type: "directory",
	status: "modified",
	children: [
		{
			path: "lib",
			type: "directory",
			status: "modified",
			children: [
				file("lib/index.js", "modified"),
				file("lib/util.js", "unchanged"),
			],
		},
		file("package.json", "modified"),
	],
};

const SHOW_ALL = {
	filter: "",
	onlyModified: false,
	hiddenPaths: new Set<string>(),
	expandedKeys: new Set<string>(),
	collapsedKeys: new Set<string>(),
};

describe("rowKey", () => {
	test("keeps a file and a folder at the same path apart", () => {
		const asFile = file("lib", "removed");
		const asFolder: DiffFileEntry = {
			path: "lib",
			type: "directory",
			status: "added",
			children: [],
		};

		expect(rowKey(asFile)).not.toBe(rowKey(asFolder));
	});

	test("gives the same entry the same key every time", () => {
		expect(rowKey(file("lib/index.js", "modified"))).toBe(
			rowKey(file("lib/index.js", "unchanged")),
		);
	});
});

const ONLY_FOLDER_WITH_A_FOLDER_INSIDE = directory("", "modified", [
	directory("src", "modified", [
		directory("src/a", "modified", [file("src/a/x.js", "modified")]),
		file("src/index.js", "modified"),
	]),
]);

function pathsShown(
	tree: DiffFileEntry,
	view: Partial<typeof SHOW_ALL>,
): string[] {
	return visibleRows(tree, { ...SHOW_ALL, ...view }).map(
		(row) => row.entry.path,
	);
}

describe("visibleRows, hiding and only-modified", () => {
	test("leaves out the files it is told to hide", () => {
		const rows = pathsShown(NESTED, {
			hiddenPaths: new Set(["lib/index.js"]),
			expandedKeys: new Set(["lib"]),
		});

		expect(rows).toEqual(["lib", "lib/util.js", "package.json"]);
	});

	test("drops a folder once everything that would show in it is hidden", () => {
		const rows = pathsShown(NESTED, {
			onlyModified: true,
			hiddenPaths: new Set(["lib/index.js"]),
		});

		expect(rows).toEqual(["package.json"]);
	});

	test("only-modified drops what did not change, and keeps what leads to it", () => {
		const rows = pathsShown(NESTED, {
			onlyModified: true,
			expandedKeys: new Set(["lib"]),
		});

		// `lib` itself is only here because something under it changed.
		expect(rows).toEqual(["lib", "lib/index.js", "package.json"]);
	});

	test("only-modified opens the folders that have something to show", () => {
		const rows = pathsShown(NESTED, { onlyModified: true });

		expect(rows).toEqual(["lib", "lib/index.js", "package.json"]);
	});
});

describe("visibleRows, filtering", () => {
	test("the filter matches anywhere in a path, whatever the case", () => {
		const rows = pathsShown(NESTED, {
			filter: "UTIL",
			expandedKeys: new Set(["lib"]),
		});

		expect(rows).toEqual(["lib", "lib/util.js"]);
	});

	test("a folder whose own name matches keeps everything under it", () => {
		const rows = pathsShown(NESTED, {
			filter: "lib",
			expandedKeys: new Set(["lib"]),
		});

		expect(rows).toEqual(["lib", "lib/index.js", "lib/util.js"]);
	});

	test("filtering opens the folders on the way to a match", () => {
		const rows = pathsShown(NESTED, { filter: "index" });

		expect(rows).toEqual(["lib", "lib/index.js"]);
	});
});

describe("visibleRows, opening and closing folders", () => {
	test("a folder's contents appear only when it is open", () => {
		expect(pathsShown(NESTED, {})).toEqual(["lib", "package.json"]);
	});

	test("opening a folder puts its contents under it, one level in", () => {
		const rows = visibleRows(NESTED, {
			...SHOW_ALL,
			expandedKeys: new Set(["lib"]),
		});

		expect(rows.map((row) => [row.entry.path, row.depth])).toEqual([
			["lib", 0],
			["lib/index.js", 1],
			["lib/util.js", 1],
			["package.json", 0],
		]);
		expect(rows[0]).toMatchObject({ expanded: true, hasChildren: true });
	});

	test("a folder closed by hand stays closed", () => {
		const rows = pathsShown(NESTED, {
			onlyModified: true,
			collapsedKeys: new Set(["lib"]),
		});

		expect(rows).toEqual(["lib", "package.json"]);
	});

	test("a package that is one folder deep opens that folder", () => {
		const single = directory("", "modified", [
			directory("src", "modified", [file("src/index.js", "modified")]),
		]);

		expect(pathsShown(single, {})).toEqual(["src", "src/index.js"]);
	});

	test("the only folder stays open when a folder inside it is opened by hand", () => {
		const rows = pathsShown(ONLY_FOLDER_WITH_A_FOLDER_INSIDE, {
			expandedKeys: new Set(["src/a"]),
		});

		expect(rows).toEqual(["src", "src/a", "src/a/x.js", "src/index.js"]);
	});
});

describe("visibleRows, the shape of the tree", () => {
	test("a path that is a file and a folder is two rows, and only the folder opens", () => {
		// `lib` is a file in one version and a folder in the other; the engine sends the old version's first.
		const both = directory("", "modified", [
			{ ...file("lib", "removed"), children: [] },
			directory("lib", "added", [file("lib/index.js", "added")]),
		]);

		const rows = visibleRows(both, {
			...SHOW_ALL,
			expandedKeys: new Set(["lib"]),
		});

		expect(
			rows.map((row) => [row.entry.path, row.entry.type, row.expanded]),
		).toEqual([
			["lib", "file", false],
			["lib", "directory", true],
			["lib/index.js", "file", false],
		]);
	});

	test("has nothing to show before a comparison has run", () => {
		expect(visibleRows(null, SHOW_ALL)).toEqual([]);
	});

	test("lists the files of a flat tree, in tree order", () => {
		const index = file("index.js", "modified");
		const manifest = file("package.json", "added");
		const tree = directory("", "modified", [index, manifest]);

		expect(visibleRows(tree, SHOW_ALL)).toEqual([
			{ entry: index, depth: 0, expanded: false, hasChildren: false },
			{ entry: manifest, depth: 0, expanded: false, hasChildren: false },
		]);
	});
});
