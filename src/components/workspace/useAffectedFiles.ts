import { type UseQueryResult, useQueries } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { flattenFiles } from "#/lib/session/tree.ts";
import {
	affectedFiles,
	commitKey,
} from "#/lib/vulnerabilities/affectedFiles.ts";
import {
	fixCommitClient,
	fixCommitsToLookUp,
} from "#/lib/vulnerabilities/fixCommitClient.ts";
import type {
	AffectedFile,
	CommitFile,
	FixCommit,
	VulnerabilityReport,
} from "#/lib/vulnerabilities/types.ts";
import type { DiffFileEntry } from "#/lib/worker/protocol.ts";

const NONE: AffectedFile[] = [];

function commitFilesOf(
	commits: FixCommit[],
	results: UseQueryResult<CommitFile[]>[],
): Map<string, CommitFile[]> {
	const files = new Map<string, CommitFile[]>();
	results.forEach(({ data }, index) => {
		const commit = commits[index];
		if (commit && data) files.set(commitKey(commit), data);
	});
	return files;
}

function useCommitFiles(
	commits: FixCommit[],
	enabled: boolean,
): Map<string, CommitFile[]> {
	const combine = useCallback(
		(results: UseQueryResult<CommitFile[]>[]) =>
			commitFilesOf(commits, results),
		[commits],
	);

	return useQueries({
		queries: commits.map((commit) => ({
			queryKey: ["fix-commit", commitKey(commit)],
			queryFn: ({ signal }: { signal: AbortSignal }) =>
				fixCommitClient.files(commit, signal),
			enabled,
			staleTime: Number.POSITIVE_INFINITY,
			retry: false,
		})),
		combine,
	});
}

export function useAffectedFiles(
	packageName: string,
	report: VulnerabilityReport | null,
	tree: DiffFileEntry | null,
): AffectedFile[] {
	const commits = useMemo(
		() => fixCommitsToLookUp(report?.entries ?? []),
		[report],
	);
	const commitFiles = useCommitFiles(commits, report !== null && tree !== null);
	const paths = useMemo(
		() => flattenFiles(tree).map((entry) => entry.path),
		[tree],
	);

	return useMemo(
		() =>
			report && tree
				? affectedFiles(report.entries, paths, packageName, commitFiles)
				: NONE,
		[report, tree, paths, packageName, commitFiles],
	);
}
