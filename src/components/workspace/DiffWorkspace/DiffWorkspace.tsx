import { useNavigate } from "@tanstack/react-router";
import { DiffToolbar } from "#/components/diff/DiffToolbar/DiffToolbar.tsx";
import { DiffView } from "#/components/diff/DiffView/DiffView.tsx";
import {
	type FileModelControls,
	useFileModel,
} from "#/components/diff/useFileModel.ts";
import type { HighlightThemeControls } from "#/components/diff/useHighlightTheme.ts";
import { useHighlightTheme } from "#/components/diff/useHighlightTheme.ts";
import { TreePanel } from "#/components/tree/TreePanel/TreePanel.tsx";
import { Spinner } from "#/components/ui/Spinner/Spinner.tsx";
import { failureOf } from "#/lib/failure/failure.ts";
import { requireAdapter } from "#/lib/registries/index.ts";
import {
	BUILT,
	type BuildProgress,
	FETCHING,
} from "#/lib/session/buildProgress.ts";
import type { DiffSessionState, OpenFile } from "#/lib/session/diffSession.ts";
import {
	changedFiles,
	summarizeTree,
	type TreeSummary,
} from "#/lib/session/tree.ts";
import { buildPath, type DiffSlug, namesComparison } from "#/lib/url/slug.ts";
import { workspaceIntro } from "#/lib/url/workspaceIntro.ts";
import type { DiffFileEntry } from "#/lib/worker/protocol.ts";
import { AsciiTrail } from "../AsciiTrail/AsciiTrail.tsx";
import { DiffProgress } from "../DiffProgress/DiffProgress.tsx";
import { DiffSummary } from "../DiffSummary/DiffSummary.tsx";
import { FailureNotice } from "../FailureNotice/FailureNotice.tsx";
import { useDiffSession } from "../useDiffSession.ts";
import { type LineLink, useLineLink } from "../useLineLink.ts";
import { useVersions } from "../useVersions.ts";
import { useViewerSettings } from "../useViewerSettings.ts";
import {
	type ScanStatus,
	useVulnerabilityFindings,
	type VulnerabilityFindings,
} from "../useVulnerabilities.ts";
import { VulnerabilityNotice } from "../VulnerabilityNotice/VulnerabilityNotice.tsx";
import { VulnerabilityReport } from "../VulnerabilityReport/VulnerabilityReport.tsx";
import { WorkspaceHeader } from "../WorkspaceHeader/WorkspaceHeader.tsx";
import styles from "./DiffWorkspace.module.css";

export function DiffWorkspace({ slug }: { slug: DiffSlug }) {
	const adapter = requireAdapter(slug.registry);
	const navigate = useNavigate();
	const { whitespace, split, signs, autohide } = useViewerSettings();
	// One instance for the toolbar and the viewer; a second would be a second answer.
	const highlight = useHighlightTheme();
	// null until the stored value is read, or a deep link would build a
	// whitespace-exact tree first and then throw it away.
	const session = useDiffSession(
		slug,
		whitespace.known ? whitespace.value : null,
	);
	// The arrows skip unchanged files, which the tree hides by default.
	const changed = changedFiles(session.tree);
	// From the session, not the URL: a file is open only once its tree is ready.
	const fileIndex = changed.findIndex(
		(entry) => entry.path === session.file?.path,
	);

	// The header's list, shared through the query cache: no second request.
	const versions = useVersions(adapter, slug.package);
	const vulnerabilities = useVulnerabilityFindings(slug, readyTree(session));

	const lineLink = useLineLink(adapter, slug);
	// What is on screen, not what was last asked for: it lags while the blur shows.
	const shown = useFileModel(session.key, session.file, split.value);
	// Unlike `session.key`, this holds still when whitespace is toggled.
	const comparisonPath = buildPath(adapter, { ...slug, file: "" });

	const versionsFailure = versions.error && failureOf(versions.error);
	const progress = shownProgress(session, slug, vulnerabilities.scan.status);
	const summary = shownSummary(session);
	const pane = paneOf(session.status, progress, versionsFailure !== null);

	function fileLink(file: string): string {
		return buildPath(adapter, { ...slug, file });
	}

	function openFile(file: string) {
		navigate({ to: fileLink(file) });
	}

	function closeFile() {
		navigate({ to: comparisonPath });
	}

	function stepFile(direction: 1 | -1) {
		const next = changed[fileIndex + direction];
		if (next) openFile(next.path);
	}

	return (
		// The e2e suites read the parsed URL and the session state from these attributes.
		<div
			className={styles.workspace}
			data-testid="workspace"
			data-state={session.status}
			data-package={slug.package}
			data-from={slug.from}
			data-to={slug.to}
			data-file={slug.file}
		>
			<TreePanel
				tree={session.tree}
				comparison={comparisonPath}
				selectedPath={slug.file}
				onOpenFile={openFile}
			/>
			<div className={styles.column}>
				<WorkspaceHeader slug={slug} />
				<main className={styles.body}>
					{versionsFailure && pane !== "progress" && (
						<FailureNotice
							{...versionsFailure}
							testId="versions-error"
							centered={pane === "versions-failure"}
						/>
					)}

					{pane !== "versions-failure" && (
						<section className={styles.file} data-testid="diff-file">
							<DiffToolbar
								path={session.file?.path ?? ""}
								fileIndex={fileIndex}
								fileCount={changed.length}
								onStepFile={stepFile}
								onClose={closeFile}
								file={shown}
								split={split.value}
								onSplitChange={split.set}
								settings={{
									ignoreWhitespace: whitespace.value,
									onIgnoreWhitespaceChange: whitespace.set,
									showSigns: signs.value,
									onShowSignsChange: signs.set,
									autohideScrollbar: autohide.value,
									onAutohideScrollbarChange: autohide.set,
									highlight,
								}}
							/>
							{showsIntro(session.status) && (
								<p className={styles.intro} data-testid="workspace-intro">
									{workspaceIntro(adapter, slug)}
								</p>
							)}
							{showsTrail(session.status, slug, progress, summary) && (
								<AsciiTrail />
							)}
							<ComparisonPane
								slug={slug}
								progress={progress}
								summary={summary}
								file={session.file}
								highlight={highlight}
								showSigns={signs.value}
								autohideScrollbar={autohide.value}
								lineLink={lineLink}
								onClose={closeFile}
								shown={shown}
								vulnerabilities={vulnerabilities}
								fileLink={fileLink}
							/>
						</section>
					)}
				</main>
			</div>
		</div>
	);
}

type Pane = "progress" | "versions-failure" | "file";

function showsIntro(status: DiffSessionState["status"]): boolean {
	return status === "idle" || status === "loading";
}

function showsTrail(
	status: DiffSessionState["status"],
	slug: DiffSlug,
	progress: BuildProgress | null,
	summary: TreeSummary | null,
): boolean {
	const isEmpty = status === "idle" && !namesComparison(slug);
	return isEmpty || progress !== null || summary !== null;
}

function shownProgress(
	session: DiffSessionState,
	slug: DiffSlug,
	scan: ScanStatus,
): BuildProgress | null {
	if (session.status === "loading" || session.status === "error")
		return session.progress;
	if (session.status === "idle" && namesComparison(slug)) return FETCHING;
	if (summaryAwaitsScan(session, scan)) return BUILT;
	return null;
}

function summaryAwaitsScan(
	session: DiffSessionState,
	scan: ScanStatus,
): boolean {
	return session.status === "ready" && !session.file && scan === "loading";
}

function readyTree(session: DiffSessionState): DiffFileEntry | null {
	return session.status === "ready" ? session.tree : null;
}

function shownSummary(session: DiffSessionState): TreeSummary | null {
	if (session.status !== "ready" || session.file) return null;
	return summarizeTree(session.tree);
}

// A comparison in progress, or one that failed, says more than its version list.
function paneOf(
	status: DiffSessionState["status"],
	progress: BuildProgress | null,
	versionsFailed: boolean,
): Pane {
	if (progress) return "progress";
	if (status === "idle" && versionsFailed) return "versions-failure";
	return "file";
}

interface ComparisonPaneProps extends FilePaneProps {
	slug: DiffSlug;
	progress: BuildProgress | null;
	summary: TreeSummary | null;
	fileLink(path: string): string;
}

function ComparisonPane({
	slug,
	progress,
	summary,
	fileLink,
	...filePane
}: ComparisonPaneProps) {
	const { scan, affected } = filePane.vulnerabilities;
	if (progress)
		return (
			<DiffProgress
				packageName={slug.package}
				from={slug.from}
				to={slug.to}
				progress={progress}
				osv={scan.status}
			/>
		);
	if (summary)
		return (
			<DiffSummary summary={summary}>
				<VulnerabilityReport
					scan={scan}
					affected={affected}
					from={slug.from}
					to={slug.to}
					fileLink={fileLink}
				/>
			</DiffSummary>
		);
	return <FilePane {...filePane} />;
}

interface FilePaneProps {
	file: OpenFile | null;
	shown: FileModelControls | null;
	onClose(): void;
	highlight: HighlightThemeControls;
	showSigns: boolean;
	autohideScrollbar: boolean;
	lineLink: LineLink;
	vulnerabilities: VulnerabilityFindings;
}

function FilePane({
	file,
	shown,
	onClose,
	highlight,
	showSigns,
	autohideScrollbar,
	lineLink,
	vulnerabilities,
}: FilePaneProps) {
	return (
		<>
			{/* Only the first file: later ones keep the previous file blurred instead. */}
			{file?.status === "loading" && !shown && (
				<Spinner label={`Loading ${file.path}…`} />
			)}
			{file?.status === "error" && (
				<FailureNotice
					message={file.error}
					code={file.errorCode}
					resetsAt={file.resetsAt}
					testId="file-error"
					centered
				/>
			)}
			{shown && (
				<>
					{/* Keyed by path, so restoring scroll is a plain mount effect. */}
					<DiffView
						file={shown}
						key={shown.path}
						onClose={onClose}
						pending={file?.status === "loading"}
						showSigns={showSigns}
						autohideScrollbar={autohideScrollbar}
						anchor={lineLink.anchorIn(shown.path)}
						onSelectLine={lineLink.select}
						highlightTheme={highlight.theme}
					/>
					<VulnerabilityNotice
						path={shown.path}
						lines={shown.lines}
						affected={vulnerabilities.affected}
						report={vulnerabilities.scan.report}
						onSelectLine={lineLink.select}
					/>
				</>
			)}
		</>
	);
}
