import { isIncidentalFile } from "./incidentalFiles.ts";
import { groupBy, unique } from "./json.ts";
import type {
	Advisory,
	AffectedFile,
	CommitFile,
	FixCommit,
	GoImport,
	ReportEntry,
} from "./types.ts";

const PATH_SEPARATOR = "/";
const RUST_PATH_SEPARATOR = "::";
const GO_SOURCE_SUFFIX = ".go";
const GO_TEST_SUFFIX = "_test.go";
const RUST_SOURCE_SUFFIX = ".rs";
const CRATE_ROOT = "src/lib.rs";
const RUST_TYPE_NAME = /^\p{Lu}/u;
const UNAMBIGUOUS_SEGMENTS = 2;

interface Tree {
	paths: string[];
	pathsByName: Map<string, string[]>;
}

type Findings = Partial<
	Pick<AffectedFile, "symbols" | "removedLines" | "addedLines">
>;

export function commitKey(commit: FixCommit): string {
	return `${commit.owner}/${commit.repo}@${commit.sha}`;
}

export function affectedFiles(
	entries: ReportEntry[],
	filePaths: string[],
	packageName: string,
	commitFiles: Map<string, CommitFile[]>,
): AffectedFile[] {
	const tree = treeOf(filePaths);
	const found = entries.flatMap(({ advisory }) => [
		...goFiles(advisory, tree, packageName),
		...crateFiles(advisory, tree),
		...fixCommitFiles(advisory, tree, commitFiles),
	]);
	return mergedByPath(found);
}

function treeOf(paths: string[]): Tree {
	return { paths, pathsByName: groupBy(paths, nameOf) };
}

function nameOf(path: string): string {
	return path.slice(path.lastIndexOf(PATH_SEPARATOR) + 1);
}

function directoryOf(path: string): string {
	return path.slice(0, Math.max(0, path.lastIndexOf(PATH_SEPARATOR)));
}

function affected(
	path: string,
	advisory: Advisory,
	findings: Findings,
): AffectedFile {
	return {
		path,
		advisoryIds: [advisory.id],
		symbols: findings.symbols ?? [],
		removedLines: findings.removedLines ?? [],
		addedLines: findings.addedLines ?? [],
	};
}

function goFiles(
	advisory: Advisory,
	tree: Tree,
	modulePath: string,
): AffectedFile[] {
	return advisory.hints.goImports.flatMap((goImport) =>
		goPackageFiles(goImport, tree, modulePath).map((path) =>
			affected(path, advisory, { symbols: goImport.symbols }),
		),
	);
}

function goPackageFiles(
	goImport: GoImport,
	tree: Tree,
	modulePath: string,
): string[] {
	const directory = goPackageDirectory(goImport.path, modulePath);
	if (directory === null) return [];
	return tree.paths.filter(
		(path) => isGoSource(path) && directoryOf(path) === directory,
	);
}

function goPackageDirectory(
	importPath: string,
	modulePath: string,
): string | null {
	if (importPath === modulePath) return "";
	const modulePrefix = `${modulePath}${PATH_SEPARATOR}`;
	if (!importPath.startsWith(modulePrefix)) return null;
	return importPath.slice(modulePrefix.length);
}

function isGoSource(path: string): boolean {
	return path.endsWith(GO_SOURCE_SUFFIX) && !path.endsWith(GO_TEST_SUFFIX);
}

function crateFiles(advisory: Advisory, tree: Tree): AffectedFile[] {
	return advisory.hints.functions.flatMap((name) => {
		const segments = name.split(RUST_PATH_SEPARATOR);
		const symbol = segments.at(-1) ?? "";
		return moduleFilesFor(modulesOf(segments), tree).map((path) =>
			affected(path, advisory, { symbols: [symbol] }),
		);
	});
}

function modulesOf(segments: string[]): string[] {
	const enclosing = segments.slice(1, -1);
	const firstType = enclosing.findIndex((segment) =>
		RUST_TYPE_NAME.test(segment),
	);
	return firstType === -1 ? enclosing : enclosing.slice(0, firstType);
}

function moduleFilesFor(modules: string[], tree: Tree): string[] {
	if (modules.length === 0)
		return tree.paths.filter((path) => path === CRATE_ROOT);
	for (let depth = modules.length; depth > 0; depth--) {
		const files = moduleFiles(
			`src/${modules.slice(0, depth).join(PATH_SEPARATOR)}`,
			tree,
		);
		if (files.length > 0) return files;
	}
	return [];
}

function moduleFiles(modulePath: string, tree: Tree): string[] {
	const declared = tree.paths.filter(
		(path) =>
			path === `${modulePath}${RUST_SOURCE_SUFFIX}` ||
			path === `${modulePath}/mod${RUST_SOURCE_SUFFIX}`,
	);
	if (declared.length > 0) return declared;
	return tree.paths.filter(
		(path) =>
			path.endsWith(RUST_SOURCE_SUFFIX) && directoryOf(path) === modulePath,
	);
}

function fixCommitFiles(
	advisory: Advisory,
	tree: Tree,
	commitFiles: Map<string, CommitFile[]>,
): AffectedFile[] {
	return advisory.hints.fixCommits
		.flatMap((commit) => commitFiles.get(commitKey(commit)) ?? [])
		.filter((file) => !isIncidentalFile(file.filename))
		.flatMap((file) =>
			treePathsOf(file.filename, tree).map((path) =>
				affected(path, advisory, {
					removedLines: file.removedLines,
					addedLines: file.addedLines,
				}),
			),
		);
}

function treePathsOf(filename: string, tree: Tree): string[] {
	const wanted = filename.split(PATH_SEPARATOR);
	const candidates = (tree.pathsByName.get(nameOf(filename)) ?? [])
		.filter((path) => !isIncidentalFile(path))
		.map((path) => ({
			path,
			shared: sharedSuffixLength(wanted, path.split(PATH_SEPARATOR)),
		}));
	const longest = Math.max(0, ...candidates.map(({ shared }) => shared));
	const best = candidates.filter(
		({ shared }) => shared === longest && shared > 0,
	);
	if (best.length > 1 && longest < UNAMBIGUOUS_SEGMENTS) return [];
	return best.map(({ path }) => path);
}

function sharedSuffixLength(a: string[], b: string[]): number {
	const shorter = Math.min(a.length, b.length);
	for (let offset = 1; offset <= shorter; offset++) {
		if (a.at(-offset) !== b.at(-offset)) return 0;
	}
	return shorter;
}

function mergedByPath(files: AffectedFile[]): AffectedFile[] {
	const byPath = new Map<string, AffectedFile>();
	for (const file of files) {
		const known = byPath.get(file.path);
		byPath.set(file.path, known ? merged(known, file) : file);
	}
	return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
}

function merged(a: AffectedFile, b: AffectedFile): AffectedFile {
	return {
		path: a.path,
		advisoryIds: unique([...a.advisoryIds, ...b.advisoryIds]),
		symbols: unique([...a.symbols, ...b.symbols]),
		removedLines: unique([...a.removedLines, ...b.removedLines]),
		addedLines: unique([...a.addedLines, ...b.addedLines]),
	};
}
