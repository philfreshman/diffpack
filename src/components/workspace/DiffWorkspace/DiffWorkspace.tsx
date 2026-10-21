import { useNavigate } from "@tanstack/react-router";
import { DiffToolbar } from "#/components/diff/DiffToolbar/DiffToolbar.tsx";
import { DiffView } from "#/components/diff/DiffView/DiffView.tsx";
import {
	type FileModelControls,
	useFileModel,
} from "#/components/diff/useFileModel.ts";
import type { HighlightThemeControls } from "#/components/diff/useHighlightTheme.ts";
import { useHighlightTheme } from "#/components/diff/useHighlightTheme.ts";
import { useSetting } from "#/components/storage/useSetting.ts";
import { ThemeToggle } from "#/components/theme/ThemeToggle/ThemeToggle.tsx";
import { TreePanel } from "#/components/tree/TreePanel/TreePanel.tsx";
import { Spinner } from "#/components/ui/Spinner/Spinner.tsx";
import { failureOf } from "#/lib/failure/failure.ts";
import { requireAdapter } from "#/lib/registries/index.ts";
import { type BuildProgress, FETCHING } from "#/lib/session/buildProgress.ts";
import type { DiffSessionState, OpenFile } from "#/lib/session/diffSession.ts";
import { changedFiles, flattenFiles } from "#/lib/session/tree.ts";
import { IGNORE_WHITESPACE, SPLIT_VIEW } from "#/lib/storage/settings.ts";
import { buildPath, type DiffSlug } from "#/lib/url/slug.ts";
import { workspaceIntro } from "#/lib/url/workspaceIntro.ts";
import { AsciiTrail } from "../AsciiTrail/AsciiTrail.tsx";
import { DiffProgress } from "../DiffProgress/DiffProgress.tsx";
import { FailureNotice } from "../FailureNotice/FailureNotice.tsx";
import { RegistrySwitcher } from "../RegistrySwitcher/RegistrySwitcher.tsx";
import { useDiffSession } from "../useDiffSession.ts";
import { useVersions } from "../useVersions.ts";
import { WorkspaceHeader } from "../WorkspaceHeader/WorkspaceHeader.tsx";
import styles from "./DiffWorkspace.module.css";

export function DiffWorkspace({ slug }: { slug: DiffSlug }) {
	const adapter = requireAdapter(slug.registry);
	const navigate = useNavigate();
	const whitespace = useSetting(IGNORE_WHITESPACE);
	// One instance for the toolbar and the viewer; a second would be a second answer.
	const highlight = useHighlightTheme();
	// null until the stored value is read, or a deep link would build a
	// whitespace-exact tree first and then throw it away.
	const session = useDiffSession(
		slug,
		whitespace.known ? whitespace.value : null,
	);
	const files = flattenFiles(session.tree);
	// The arrows skip unchanged files, which the tree hides by default.
	const changed = changedFiles(session.tree);
	// From the session, not the URL: a file is open only once its tree is ready.
	const fileIndex = changed.findIndex(
		(entry) => entry.path === session.file?.path,
	);

	// The header's list, shared through the query cache: no second request.
	const versions = useVersions(adapter, slug.package);

	const split = useSetting(SPLIT_VIEW);
	// What is on screen, not what was last asked for: it lags while the blur shows.
	const shown = useFileModel(session.key, session.file, split.value);
	// Unlike `session.key`, this holds still when whitespace is toggled.
	const comparisonPath = buildPath(adapter, { ...slug, file: "" });

	const versionsFailure = versions.error && failureOf(versions.error);
	const progress = shownProgress(session, slug);
	const pane = paneOf(session.status, progress, versionsFailure !== null);

	function openFile(file: string) {
		navigate({ to: buildPath(adapter, { ...slug, file }) });
	}

	function closeFile() {
		navigate({ to: comparisonPath });
	}

	function stepFile(direction: 1 | -1) {
		const next = changed[fileIndex + direction];
		if (next) openFile(next.path);
	}

	return (
		// The routing e2e suite reads the parsed URL from these attributes.
		<div
			className={styles.workspace}
			data-testid="workspace"
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
				header={<RegistrySwitcher adapter={adapter} />}
				footer={
					<>
						<TreeStatus
							changedCount={changed.length}
							fileCount={files.length}
							status={session.status}
						/>
						<ThemeToggle />
					</>
				}
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
								ignoreWhitespace={whitespace.value}
								onIgnoreWhitespaceChange={whitespace.set}
								highlight={highlight}
							/>
							{showsIntro(session.status) && (
								<p className={styles.empty} data-testid="workspace-intro">
									{workspaceIntro(adapter, slug)}
								</p>
							)}
							{isEmpty(session.status, slug) && <AsciiTrail />}
							{progress ? (
								<DiffProgress
									packageName={slug.package}
									from={slug.from}
									to={slug.to}
									progress={progress}
								/>
							) : (
								<FilePane
									file={session.file}
									highlight={highlight}
									onClose={closeFile}
									shown={shown}
								/>
							)}
						</section>
					)}
				</main>
			</div>
		</div>
	);
}

type Pane = "progress" | "versions-failure" | "file";

function namesComparison(slug: DiffSlug): boolean {
	return Boolean(slug.package && slug.from && slug.to);
}

function showsIntro(status: DiffSessionState["status"]): boolean {
	return status === "idle" || status === "loading";
}

function isEmpty(status: DiffSessionState["status"], slug: DiffSlug): boolean {
	return status === "idle" && !namesComparison(slug);
}

function shownProgress(
	session: DiffSessionState,
	slug: DiffSlug,
): BuildProgress | null {
	if (session.status === "loading" || session.status === "error")
		return session.progress;
	if (session.status === "idle" && namesComparison(slug)) return FETCHING;
	return null;
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

interface TreeStatusProps {
	status: DiffSessionState["status"];
	fileCount: number;
	changedCount: number;
}

// Rendered even when empty: tests read the state off `data-state`.
function TreeStatus({ status, fileCount, changedCount }: TreeStatusProps) {
	return (
		<p className={styles.status} data-testid="diff-status" data-state={status}>
			{status === "ready" &&
				`${fileCount} ${fileCount === 1 ? "file" : "files"}, ${changedCount} changed`}
		</p>
	);
}

interface FilePaneProps {
	file: OpenFile | null;
	shown: FileModelControls | null;
	onClose(): void;
	highlight: HighlightThemeControls;
}

function FilePane({ file, shown, onClose, highlight }: FilePaneProps) {
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
				// Keyed by path, so restoring scroll is a plain mount effect.
				<DiffView
					file={shown}
					key={shown.path}
					onClose={onClose}
					pending={file?.status === "loading"}
					syntax={highlight.appearance}
				/>
			)}
		</>
	);
}
