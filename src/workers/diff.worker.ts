import { registries } from "../registries/registries.ts";

export type DiffStatus = "added" | "removed" | "modified" | "unchanged";

export type DiffFileEntry = {
	path: string;
	type: "file" | "directory";
	status: DiffStatus;
	diffCount?: number;
	children?: DiffFileEntry[];
};

type WorkerRequest =
	| {
			type: "start-diff";
			registry: string;
			pkg: string;
			from: string;
			to: string;
	  }
	| {
			type: "get-diff";
			filename: string;
			fromContent?: string;
			toContent?: string;
	  };

export type FileMapEntry = {
	type: "file" | "directory";
	content: string;
};

const decoder = new TextDecoder();

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
	const data = event.data;

	if (data.type === "start-diff") {
		await handleStartDiff(data.registry, data.pkg, data.from, data.to);
	} else if (data.type === "get-diff") {
		handleGetDiff(data.filename, data.fromContent, data.toContent);
	}
};

async function handleStartDiff(
	registry: string,
	pkg: string,
	from: string,
	to: string,
) {
	try {
		const registryImpl = registries[registry];
		if (!registryImpl) {
			throw new Error(`Unsupported registry: ${registry}`);
		}

		const [fromTarball, toTarball] = await Promise.all([
			registryImpl.getPackage(pkg, from),
			registryImpl.getPackage(pkg, to),
		]);

		const [fromFiles, toFiles] = await Promise.all([
			extractTarball(fromTarball),
			extractTarball(toTarball),
		]);

		const diffTree = buildDiffTree(fromFiles, toFiles);

		postMessage({
			type: "diff-result",
			data: diffTree,
			fromFiles,
			toFiles,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		postMessage({ type: "error", error: message });
	}
}

export async function extractTarball(
	tarballBuffer: ArrayBuffer,
): Promise<Record<string, FileMapEntry>> {
	const tarBuffer = await gunzip(tarballBuffer);
	return parseTar(tarBuffer);
}

export async function gunzip(buffer: ArrayBuffer): Promise<ArrayBuffer> {
	if (typeof DecompressionStream === "undefined") {
		throw new Error("Gzip decompression is not supported in this environment");
	}

	const decompressedStream = new Blob([buffer])
		.stream()
		.pipeThrough(new DecompressionStream("gzip"));
	const response = new Response(decompressedStream);
	return response.arrayBuffer();
}

export function parseTar(buffer: ArrayBuffer): Record<string, FileMapEntry> {
	const bytes = new Uint8Array(buffer);
	const files: Record<string, FileMapEntry> = {};

	let offset = 0;
	while (offset + 512 <= bytes.length) {
		if (isEndOfArchive(bytes, offset)) {
			break;
		}

		const name = readString(bytes, offset, 100);
		const size = readOctal(bytes, offset + 124, 12);
		const typeFlag = bytes[offset + 156];
		const isDirectory = typeFlag === 53; // "5" in ASCII
		const normalizedName = normalizePath(name, isDirectory);

		if (normalizedName) {
			if (isDirectory) {
				files[normalizedName] = { type: "directory", content: "" };
			} else {
				const contentStart = offset + 512;
				const content = bytes.slice(contentStart, contentStart + size);
				files[normalizedName] = {
					type: "file",
					content: decoder.decode(content),
				};
			}
		}

		const blocks = Math.ceil(size / 512);
		offset += 512 + blocks * 512;
	}

	// Ensure directories derived from file paths are present
	Object.keys(files).forEach((path) => {
		const parts = path.split("/");
		for (let i = 1; i < parts.length; i++) {
			const dirPath = parts.slice(0, i).join("/");
			if (dirPath && !files[dirPath]) {
				files[dirPath] = { type: "directory", content: "" };
			}
		}
	});

	return files;
}

function isEndOfArchive(bytes: Uint8Array, offset: number) {
	for (let i = offset; i < offset + 512; i++) {
		if (bytes[i] !== 0) return false;
	}
	return true;
}

function readString(bytes: Uint8Array, offset: number, length: number): string {
	const slice = bytes.slice(offset, offset + length);
	const raw = decoder.decode(slice);
	return raw.replace(/\0+.*$/, "").trim();
}

function readOctal(bytes: Uint8Array, offset: number, length: number): number {
	const str = readString(bytes, offset, length).trim();
	return str ? parseInt(str, 8) : 0;
}

function normalizePath(path: string, isDirectory: boolean): string {
	if (!path) return "";
	const trimmed = path.replace(/^\/+/, "");
	if (isDirectory) {
		return trimmed.replace(/\/+$/, "");
	}
	return trimmed;
}

export function buildDiffTree(
	fromFiles: Record<string, FileMapEntry>,
	toFiles: Record<string, FileMapEntry>,
): DiffFileEntry {
	const root: DiffFileEntry = {
		path: "/",
		type: "directory",
		status: "unchanged",
		children: [],
	};

	const fromPaths = new Set(Object.keys(fromFiles));
	const toPaths = new Set(Object.keys(toFiles));
	const fromDirs = collectDirectories(fromPaths);
	const toDirs = collectDirectories(toPaths);

	const allPaths = new Set<string>([
		...fromPaths,
		...toPaths,
		...fromDirs,
		...toDirs,
	]);

	const sortedPaths = Array.from(allPaths).filter(Boolean).sort();
	for (const path of sortedPaths) {
		const type: "file" | "directory" =
			(fromFiles[path]?.type || toFiles[path]?.type) === "directory" ||
			fromDirs.has(path) ||
			toDirs.has(path)
				? "directory"
				: "file";
		insertNode(root, path, type);
	}

	computeStatuses(root, fromFiles, toFiles, fromDirs, toDirs);
	return root;
}

function collectDirectories(paths: Set<string>): Set<string> {
	const dirs = new Set<string>();
	for (const path of paths) {
		const segments = path.split("/");
		for (let i = 1; i < segments.length; i++) {
			const dir = segments.slice(0, i).join("/");
			if (dir) dirs.add(dir);
		}
	}
	return dirs;
}

function insertNode(
	root: DiffFileEntry,
	fullPath: string,
	type: "file" | "directory",
) {
	const parts = fullPath.split("/");
	let current = root;

	for (let i = 0; i < parts.length; i++) {
		const partPath = parts.slice(0, i + 1).join("/");
		const isLeaf = i === parts.length - 1;
		current.children = current.children || [];
		let child = current.children.find((c) => c.path === partPath);

		if (!child) {
			child = {
				path: partPath,
				type: isLeaf ? type : "directory",
				status: "unchanged",
				children: [],
			};
			current.children.push(child);
		}

		current = child;
	}
}

function computeStatuses(
	node: DiffFileEntry,
	fromFiles: Record<string, FileMapEntry>,
	toFiles: Record<string, FileMapEntry>,
	fromDirs: Set<string>,
	toDirs: Set<string>,
): { status: DiffStatus; diffCount: number } {
	if (node.type === "file") {
		const fromEntry = fromFiles[node.path];
		const toEntry = toFiles[node.path];

		if (fromEntry && !toEntry) {
			node.status = "removed";
			node.diffCount = -fromEntry.content.split("\n").length;
		} else if (!fromEntry && toEntry) {
			node.status = "added";
			node.diffCount = toEntry.content.split("\n").length;
		} else if (fromEntry && toEntry) {
			if (fromEntry.content === toEntry.content) {
				node.status = "unchanged";
				node.diffCount = 0;
			} else {
				node.status = "modified";
				const fromLines = fromEntry.content.split("\n");
				const toLines = toEntry.content.split("\n");
				const { added, removed } = countDiff(fromLines, toLines);
				node.diffCount = added - removed;
			}
		} else {
			node.status = "unchanged";
			node.diffCount = 0;
		}
		return { status: node.status, diffCount: node.diffCount || 0 };
	}

	const children = node.children || [];
	const childResults = children.map((child) =>
		computeStatuses(child, fromFiles, toFiles, fromDirs, toDirs),
	);

	const inFrom = node.path === "/" || fromDirs.has(node.path);
	const inTo = node.path === "/" || toDirs.has(node.path);

	const totalDiffCount = childResults.reduce((acc, curr) => acc + curr.diffCount, 0);
	node.diffCount = totalDiffCount;

	if (inFrom && !inTo) {
		node.status = "removed";
	} else if (!inFrom && inTo) {
		node.status = "added";
	} else if (childResults.every((res) => res.status === "unchanged")) {
		node.status = "unchanged";
	} else {
		node.status = "modified";
	}

	return { status: node.status, diffCount: node.diffCount };
}

function countDiff(fromLines: string[], toLines: string[]): { added: number, removed: number } {
	const m = fromLines.length;
	const n = toLines.length;
	const dp: number[][] = Array.from({ length: m + 1 }, () =>
		Array(n + 1).fill(0),
	);

	for (let i = m - 1; i >= 0; i--) {
		for (let j = n - 1; j >= 0; j--) {
			if (fromLines[i] === toLines[j]) {
				dp[i][j] = dp[i + 1][j + 1] + 1;
			} else {
				dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
			}
		}
	}

	let added = 0;
	let removed = 0;
	let i = 0;
	let j = 0;

	while (i < m && j < n) {
		if (fromLines[i] === toLines[j]) {
			i++;
			j++;
		} else if (dp[i + 1][j] >= dp[i][j + 1]) {
			removed++;
			i++;
		} else {
			added++;
			j++;
		}
	}

	while (i < m) {
		removed++;
		i++;
	}

	while (j < n) {
		added++;
		j++;
	}

	return { added, removed };
}

export function handleGetDiff(
	filename: string,
	fromContent?: string,
	toContent?: string,
) {
	let result: string;
	let isDiff = true;

	if (fromContent === undefined && toContent === undefined) {
		result = "File not present in either version.";
		isDiff = false;
	} else if (fromContent === undefined) {
		const toLines = (toContent ?? "").split("\n");
		const header = `--- /dev/null\n+++ to/${filename}`;
		result = [header, ...toLines.map((line) => `+ ${line}`)].join("\n");
	} else if (toContent === undefined) {
		const fromLines = (fromContent ?? "").split("\n");
		const header = `--- from/${filename}\n+++ /dev/null`;
		result = [header, ...fromLines.map((line) => `- ${line}`)].join("\n");
	} else if (fromContent === toContent) {
		result = toContent ?? "";
		isDiff = false;
	} else {
		const fromLines = fromContent.split("\n");
		const toLines = toContent.split("\n");

		const m = fromLines.length;
		const n = toLines.length;
		const dp: number[][] = Array.from({ length: m + 1 }, () =>
			Array(n + 1).fill(0),
		);

		for (let i = m - 1; i >= 0; i--) {
			for (let j = n - 1; j >= 0; j--) {
				if (fromLines[i] === toLines[j]) {
					dp[i][j] = dp[i + 1][j + 1] + 1;
				} else {
					dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
				}
			}
		}

		const edits: { type: " " | "+" | "-"; line: string }[] = [];
		let i = 0;
		let j = 0;

		while (i < m && j < n) {
			if (fromLines[i] === toLines[j]) {
				edits.push({ type: " ", line: fromLines[i] });
				i++;
				j++;
			} else if (dp[i + 1][j] >= dp[i][j + 1]) {
				edits.push({ type: "-", line: fromLines[i] });
				i++;
			} else {
				edits.push({ type: "+", line: toLines[j] });
				j++;
			}
		}

		while (i < m) {
			edits.push({ type: "-", line: fromLines[i] });
			i++;
		}

		while (j < n) {
			edits.push({ type: "+", line: toLines[j] });
			j++;
		}

		const header = `--- from/${filename}\n+++ to/${filename}`;
		result = [header, ...edits.map((e) => `${e.type} ${e.line}`)].join("\n");
	}

	postMessage({ type: "diff-result", filename, data: result, isDiff });
}
