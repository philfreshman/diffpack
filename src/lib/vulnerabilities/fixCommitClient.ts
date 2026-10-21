import { getJson } from "#/lib/registries/http.ts";
import type { Fetcher } from "#/lib/registries/types.ts";
import { commitKey } from "./affectedFiles.ts";
import { isFixCommit } from "./fixCommitReference.ts";
import { arrayOf, objectOf, stringOf, uniqueBy } from "./json.ts";
import type { CommitFile, FixCommit, ReportEntry } from "./types.ts";

const GITHUB_API_ORIGIN = "https://api.github.com";
export const MAX_FIX_COMMITS = 5;

const HUNK_HEADER = "@@";
const REMOVED_SIGN = "-";
const ADDED_SIGN = "+";

export interface FixCommitClient {
	files(commit: FixCommit, signal?: AbortSignal): Promise<CommitFile[]>;
}

function commitUrl({ owner, repo, sha }: FixCommit): string {
	const path = [owner, repo, "commits", sha].map(encodeURIComponent).join("/");
	return `${GITHUB_API_ORIGIN}/repos/${path}`;
}

export function createFixCommitClient(
	fetcher: Fetcher = fetch,
): FixCommitClient {
	return {
		async files(commit, signal) {
			if (!isFixCommit(commit)) {
				throw new Error(`GitHub: ${commitKey(commit)} is not a commit`);
			}
			const answer = await getJson<unknown>(
				fetcher,
				commitUrl(commit),
				signal,
				`GitHub: commit ${commitKey(commit)} could not be read`,
			);
			return arrayOf(objectOf(answer).files)
				.map(objectOf)
				.map((file) =>
					commitFileOf(stringOf(file.filename), stringOf(file.patch)),
				)
				.filter((file) => file.filename !== "");
		},
	};
}

function commitFileOf(filename: string, patch: string): CommitFile {
	const lines = patch
		.split("\n")
		.filter((line) => !line.startsWith(HUNK_HEADER));
	return {
		filename,
		removedLines: changedText(lines, REMOVED_SIGN),
		addedLines: changedText(lines, ADDED_SIGN),
	};
}

function changedText(lines: string[], sign: string): string[] {
	return lines
		.filter((line) => line.startsWith(sign))
		.map((line) => line.slice(sign.length));
}

export function fixCommitsToLookUp(entries: ReportEntry[]): FixCommit[] {
	const commits = entries.flatMap((entry) => entry.advisory.hints.fixCommits);
	return uniqueBy(commits, commitKey).slice(0, MAX_FIX_COMMITS);
}

export const fixCommitClient = createFixCommitClient();
