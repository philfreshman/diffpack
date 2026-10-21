import type { FixCommit } from "./types.ts";

const NAME = "[A-Za-z0-9_.-]+";
const SHA = "[0-9a-f]{7,40}";
const COMMIT_PATH = `(?:commit|pull/\\d+/commits)/(${SHA})`;
const FIX_COMMIT_URL = new RegExp(
	`^https://github\\.com/(${NAME})/(${NAME})/${COMMIT_PATH}/?(?:[?#].*)?$`,
);
const WHOLE_NAME = new RegExp(`^${NAME}$`);
const WHOLE_SHA = new RegExp(`^${SHA}$`);
const ONLY_DOTS = /^\.+$/;

function isRepositoryName(name: string): boolean {
	return WHOLE_NAME.test(name) && !ONLY_DOTS.test(name);
}

export function isFixCommit(commit: FixCommit): boolean {
	return (
		isRepositoryName(commit.owner) &&
		isRepositoryName(commit.repo) &&
		WHOLE_SHA.test(commit.sha)
	);
}

export function fixCommitOf(url: string): FixCommit | null {
	const match = FIX_COMMIT_URL.exec(url);
	if (!match) return null;
	const [, owner = "", repo = "", sha = ""] = match;
	const commit = { owner, repo, sha };
	return isFixCommit(commit) ? commit : null;
}
