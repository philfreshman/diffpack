import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stripVTControlCharacters } from "node:util";
import { $, argv, file } from "bun";

const USAGE = "Usage: bun scripts/ci-failure.ts <pr-number> | --run <run-id>";
const ERROR_MARKER = "##[error]";
const WARNING_MARKER = "##[warning]";
const LINES_BEFORE_ERROR = 25;
const E2E_JOB = "end-to-end";
const PLAYWRIGHT_REPORT_ARTIFACT = "playwright-report";
const FIRST_REPORTED_SECTION = "# Test info";
const FIRST_SKIPPED_SECTION = "# Page snapshot";
const JOB_URL = /\/actions\/runs\/(\d+)\/job\/(\d+)/;
const TIMESTAMP_PREFIX = /^\d{4}-\d\d-\d\dT[\d:.]+Z /;
const ENVIRONMENT_LINE = /^\s+[A-Z][A-Z0-9_]*:( |$)/;
const STEP_BOUNDARY = /^##\[(end)?group\]/;
const NUMBER = /^\d+$/;

interface FailedJob {
	runId: string;
	jobId: string;
	name: string;
}

interface CheckRun {
	name: string;
	conclusion: string;
	detailsUrl?: string;
}

interface WorkflowJob {
	id: number;
	name: string;
	conclusion: string | null;
}

function jobOfCheck(check: CheckRun): FailedJob[] {
	const [, runId, jobId] = JOB_URL.exec(check.detailsUrl ?? "") ?? [];
	if (!runId || !jobId) return [];
	return [{ runId, jobId, name: check.name }];
}

async function failedJobsOfPr(pr: string): Promise<FailedJob[]> {
	const { statusCheckRollup } =
		(await $`gh pr view ${pr} --json statusCheckRollup`.json()) as {
			statusCheckRollup: CheckRun[];
		};
	return statusCheckRollup
		.filter((check) => check.conclusion === "FAILURE")
		.flatMap(jobOfCheck);
}

async function failedJobsOfRun(runId: string): Promise<FailedJob[]> {
	const { jobs } =
		(await $`gh api repos/{owner}/{repo}/actions/runs/${runId}/jobs?per_page=100`.json()) as {
			jobs: WorkflowJob[];
		};
	return jobs
		.filter((job) => job.conclusion === "failure")
		.map((job) => ({ runId, jobId: String(job.id), name: job.name }));
}

function failedJobsFor(args: string[]): Promise<FailedJob[]> {
	const [first, second] = args;
	if (first === "--run" && second && NUMBER.test(second))
		return failedJobsOfRun(second);
	if (first && NUMBER.test(first)) return failedJobsOfPr(first);

	console.error(USAGE);
	process.exit(2);
}

function cleanLines(log: string): string[] {
	return stripVTControlCharacters(log)
		.split("\n")
		.map((line) => line.replace(TIMESTAMP_PREFIX, "").trimEnd());
}

function isWorthShowing(line: string): boolean {
	return line !== "" && !ENVIRONMENT_LINE.test(line);
}

function contextStart(lines: string[], errorIndex: number): number {
	const earliest = Math.max(0, errorIndex - LINES_BEFORE_ERROR);
	for (let i = errorIndex - 1; i >= earliest; i--)
		if (STEP_BOUNDARY.test(lines[i] ?? "")) return i + 1;
	return earliest;
}

function excerptIndices(lines: string[]): number[] {
	const kept = new Set<number>();
	lines.forEach((line, index) => {
		if (line.includes(WARNING_MARKER)) kept.add(index);
		if (!line.includes(ERROR_MARKER)) return;
		for (let i = contextStart(lines, index); i <= index; i++) kept.add(i);
	});
	return [...kept].sort((a, b) => a - b);
}

function excerpt(lines: string[]): string {
	const shown: string[] = [];
	let previous = -1;
	for (const index of excerptIndices(lines)) {
		const line = lines[index];
		if (line === undefined || !isWorthShowing(line)) continue;
		if (previous !== -1 && index > previous + 1) shown.push("…");
		shown.push(line);
		previous = index;
	}
	return shown.join("\n");
}

async function jobLog(jobId: string): Promise<string | undefined> {
	const result =
		await $`gh api --allow-escape-sequences repos/{owner}/{repo}/actions/jobs/${jobId}/logs`
			.nothrow()
			.quiet();
	return result.exitCode === 0 ? result.stdout.toString() : undefined;
}

function reportedSections(errorContext: string): string {
	const start = errorContext.indexOf(FIRST_REPORTED_SECTION);
	const end = errorContext.indexOf(FIRST_SKIPPED_SECTION);
	return errorContext
		.slice(Math.max(start, 0), end === -1 ? undefined : end)
		.trim();
}

async function errorContextFiles(reportDir: string): Promise<string[]> {
	const resultsDir = join(reportDir, "test-results");
	const testDirs = await readdir(resultsDir).catch(() => []);
	return testDirs.map((testDir) =>
		join(resultsDir, testDir, "error-context.md"),
	);
}

async function reportPlaywrightFailures(runId: string): Promise<void> {
	const reportDir = await mkdtemp(join(tmpdir(), "ci-failure-"));
	const download =
		await $`gh run download ${runId} -n ${PLAYWRIGHT_REPORT_ARTIFACT} -D ${reportDir}`
			.nothrow()
			.quiet();
	if (download.exitCode !== 0) {
		console.log(
			`No ${PLAYWRIGHT_REPORT_ARTIFACT} artifact on run ${runId} yet.`,
		);
		return;
	}

	for (const path of await errorContextFiles(reportDir)) {
		const errorContext = file(path);
		if (await errorContext.exists())
			console.log(`\n${reportedSections(await errorContext.text())}`);
	}
	console.log(`\nFull report and traces: ${reportDir}`);
}

async function reportJob(job: FailedJob): Promise<void> {
	console.log(`\n=== ${job.name} (run ${job.runId}, job ${job.jobId})`);
	const log = await jobLog(job.jobId);
	console.log(
		log === undefined
			? "Log not available yet: the job may still be running."
			: excerpt(cleanLines(log)),
	);
	if (job.name === E2E_JOB) await reportPlaywrightFailures(job.runId);
}

const failedJobs = await failedJobsFor(argv.slice(2));
if (failedJobs.length === 0) console.log("No failed jobs.");
for (const job of failedJobs) await reportJob(job);
