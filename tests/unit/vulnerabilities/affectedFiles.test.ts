import { describe, expect, test } from "bun:test";
import {
	affectedFiles,
	commitKey,
} from "#/lib/vulnerabilities/affectedFiles.ts";
import type { CommitFile } from "#/lib/vulnerabilities/types.ts";
import { introduced } from "./advisoryStub.ts";

const NO_COMMITS = new Map<string, CommitFile[]>();

function paths(files: ReturnType<typeof affectedFiles>): string[] {
	return files.map(({ path }) => path);
}

describe("Go packages", () => {
	const tree = [
		"go.mod",
		"html/render.go",
		"html/render_test.go",
		"html/atom/atom.go",
		"html/README.md",
		"http2/server.go",
		"net.go",
	];

	test("are the Go sources directly in the package's directory", () => {
		const entry = introduced({
			id: "GO-2023-1988",
			hints: {
				goImports: [
					{ path: "golang.org/x/net/html", symbols: ["Render", "render1"] },
				],
			},
		});

		expect(
			affectedFiles([entry], tree, "golang.org/x/net", NO_COMMITS),
		).toEqual([
			{
				path: "html/render.go",
				advisoryIds: ["GO-2023-1988"],
				symbols: ["Render", "render1"],
				removedLines: [],
				addedLines: [],
			},
		]);
	});

	test("include the module root when the module itself is imported", () => {
		const entry = introduced({
			id: "GO-1",
			hints: { goImports: [{ path: "golang.org/x/net", symbols: [] }] },
		});

		expect(
			paths(affectedFiles([entry], tree, "golang.org/x/net", NO_COMMITS)),
		).toEqual(["net.go"]);
	});

	test("ignore imports from another module", () => {
		const entry = introduced({
			id: "GO-2",
			hints: {
				goImports: [{ path: "golang.org/x/network/html", symbols: [] }],
			},
		});

		expect(
			affectedFiles([entry], tree, "golang.org/x/net", NO_COMMITS),
		).toEqual([]);
	});
});

describe("crate functions", () => {
	const tree = [
		"Cargo.toml",
		"src/lib.rs",
		"src/task/mod.rs",
		"src/task/local.rs",
		"src/sync/oneshot.rs",
		"src/io/util/read.rs",
		"src/io/util/write.rs",
	];

	function filesFor(name: string) {
		const entry = introduced({ id: "RUSTSEC-1", hints: { functions: [name] } });
		return affectedFiles([entry], tree, "tokio", NO_COMMITS);
	}

	test("land in the module's own file, named by the function", () => {
		expect(filesFor("tokio::sync::oneshot::Receiver::close")).toEqual([
			{
				path: "src/sync/oneshot.rs",
				advisoryIds: ["RUSTSEC-1"],
				symbols: ["close"],
				removedLines: [],
				addedLines: [],
			},
		]);
	});

	test("land in a module's mod.rs", () => {
		expect(paths(filesFor("tokio::task::JoinHandle::abort"))).toEqual([
			"src/task/mod.rs",
		]);
	});

	test("land in the files of a module directory without a mod.rs", () => {
		expect(paths(filesFor("tokio::io::util::copy"))).toEqual([
			"src/io/util/read.rs",
			"src/io/util/write.rs",
		]);
	});

	test("land in the crate root for a function at the top", () => {
		expect(paths(filesFor("tokio::spawn"))).toEqual(["src/lib.rs"]);
	});

	test("land in the crate root for a method of a type defined there", () => {
		expect(paths(filesFor("tokio::Runtime::block_on"))).toEqual(["src/lib.rs"]);
	});

	test("land in the module of the type a method belongs to", () => {
		expect(paths(filesFor("tokio::task::JoinSet::spawn"))).toEqual([
			"src/task/mod.rs",
		]);
	});

	test("land nowhere when no module matches", () => {
		expect(filesFor("tokio::net::TcpStream::connect")).toEqual([]);
	});
});

describe("fix commit files", () => {
	const commit = { owner: "o", repo: "r", sha: "abc1234" };

	function filesFor(tree: string[], ...changed: string[]) {
		const commitFiles = new Map([
			[
				commitKey(commit),
				changed.map((filename) => ({
					filename,
					removedLines: [`old ${filename}`],
					addedLines: [`new ${filename}`],
				})),
			],
		]);
		const entry = introduced({ id: "GHSA-1", hints: { fixCommits: [commit] } });
		return affectedFiles([entry], tree, "pkg", commitFiles);
	}

	test("match a tree path that ends with the commit's path", () => {
		expect(filesFor(["package/lib/trim.js"], "lib/trim.js")).toEqual([
			{
				path: "package/lib/trim.js",
				advisoryIds: ["GHSA-1"],
				symbols: [],
				removedLines: ["old lib/trim.js"],
				addedLines: ["new lib/trim.js"],
			},
		]);
	});

	test("match a tree path the commit's path ends with", () => {
		expect(
			paths(filesFor(["trim.js", "index.js"], "packages/lodash/trim.js")),
		).toEqual(["trim.js"]);
	});

	test("prefer the longest match", () => {
		expect(
			paths(
				filesFor(["src/a/index.js", "src/b/index.js"], "repo/src/a/index.js"),
			),
		).toEqual(["src/a/index.js"]);
	});

	test("ignore a file name shared by several tree paths", () => {
		expect(
			filesFor(["a/index.js", "b/index.js"], "packages/c/index.js"),
		).toEqual([]);
	});

	test("ignore paths that only share some trailing folders", () => {
		expect(filesFor(["dist/util/trim.js"], "src/util/trim.js")).toEqual([]);
	});

	test("ignore manifests, lockfiles, documentation and tests", () => {
		const tree = [
			"package.json",
			"README.md",
			"History.md",
			"lib/router.js",
			"lib/router.test.js",
			"test/router.js",
		];
		expect(
			paths(
				filesFor(
					tree,
					"package.json",
					"README.md",
					"History.md",
					"lib/router.test.js",
					"test/router.js",
					"lib/router.js",
				),
			),
		).toEqual(["lib/router.js"]);
	});

	test("ignore a commit that was not looked up", () => {
		const entry = introduced({
			id: "GHSA-2",
			hints: { fixCommits: [{ owner: "o", repo: "r", sha: "fff0000" }] },
		});
		expect(affectedFiles([entry], ["trim.js"], "pkg", NO_COMMITS)).toEqual([]);
	});
});

describe("affectedFiles", () => {
	test("merges what several advisories say about one file and sorts by path", () => {
		const entries = [
			introduced({
				id: "GO-1",
				hints: { goImports: [{ path: "m/b", symbols: ["Parse"] }] },
			}),
			introduced({
				id: "GO-2",
				hints: { goImports: [{ path: "m/b", symbols: ["Parse", "Render"] }] },
			}),
			introduced({
				id: "GO-3",
				hints: { goImports: [{ path: "m/a", symbols: ["Open"] }] },
			}),
		];

		expect(
			affectedFiles(entries, ["b/b.go", "a/a.go"], "m", NO_COMMITS),
		).toEqual([
			{
				path: "a/a.go",
				advisoryIds: ["GO-3"],
				symbols: ["Open"],
				removedLines: [],
				addedLines: [],
			},
			{
				path: "b/b.go",
				advisoryIds: ["GO-1", "GO-2"],
				symbols: ["Parse", "Render"],
				removedLines: [],
				addedLines: [],
			},
		]);
	});
});
