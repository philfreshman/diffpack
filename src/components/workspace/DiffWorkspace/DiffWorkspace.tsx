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
import {
	type FailureCode,
	failureOf,
	isProxyLimit,
} from "#/lib/failure/failure.ts";
import { requireAdapter } from "#/lib/registries/index.ts";
import type { DiffSessionState, OpenFile } from "#/lib/session/diffSession.ts";
import { changedFiles, flattenFiles } from "#/lib/session/tree.ts";
import { IGNORE_WHITESPACE, SPLIT_VIEW } from "#/lib/storage/settings.ts";
import { buildPath, type DiffSlug } from "#/lib/url/slug.ts";
import { ProxyLimitNotice } from "../ProxyLimitNotice/ProxyLimitNotice.tsx";
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

	const failure = workspaceFailure(session, versions.error);
	// With no diff to show, the failure takes the pane; beside one it sits above it.
	const failed =
		failure !== null &&
		(session.status === "error" || session.status === "idle");

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
							packageName={slug.package}
							status={session.status}
						/>
						<ThemeToggle />
					</>
				}
			/>
			<div className={styles.column}>
				<WorkspaceHeader slug={slug} />
				<main className={styles.body}>
					{failure && (
						<FailureNotice
							{...failure}
							className={failed ? styles.centered : undefined}
						/>
					)}

					{!failed && (
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
							<FilePane
								file={session.file}
								highlight={highlight}
								onClose={closeFile}
								sessionStatus={session.status}
								shown={shown}
							/>
						</section>
					)}
				</main>
			</div>
		</div>
	);
}

interface ShownFailure {
	message: string | null;
	code: FailureCode | null | undefined;
	resetsAt: string | null | undefined;
	testId: string;
}

// A failed build says more than the version list it was started from.
function workspaceFailure(
	session: DiffSessionState,
	versionsError: Error | null,
): ShownFailure | null {
	if (session.status === "error")
		return {
			message: session.error,
			code: session.errorCode,
			resetsAt: session.resetsAt,
			testId: "diff-error",
		};
	if (!versionsError) return null;

	const { message, code, resetsAt } = failureOf(versionsError);
	return { message, code, resetsAt, testId: "versions-error" };
}

/** `className` places the notice; the box itself always looks the same. */
function FailureNotice({
	message,
	code,
	resetsAt,
	testId,
	className,
}: ShownFailure & { className?: string }) {
	return (
		<div className={className}>
			{isProxyLimit(code) ? (
				<ProxyLimitNotice code={code} resetsAt={resetsAt} />
			) : (
				<p className={styles.error} role="alert" data-testid={testId}>
					{message}
				</p>
			)}
		</div>
	);
}

interface TreeStatusProps {
	status: DiffSessionState["status"];
	packageName: string;
	fileCount: number;
	changedCount: number;
}

// Rendered even when empty: tests read the state off `data-state`.
function TreeStatus({
	status,
	packageName,
	fileCount,
	changedCount,
}: TreeStatusProps) {
	return (
		<p className={styles.status} data-testid="diff-status" data-state={status}>
			{status === "loading" && <Spinner label={`Comparing ${packageName}…`} />}
			{status === "ready" &&
				`${fileCount} ${fileCount === 1 ? "file" : "files"}, ${changedCount} changed`}
		</p>
	);
}

interface FilePaneProps {
	sessionStatus: DiffSessionState["status"];
	file: OpenFile | null;
	shown: FileModelControls | null;
	onClose(): void;
	highlight: HighlightThemeControls;
}

function FilePane({
	sessionStatus,
	file,
	shown,
	onClose,
	highlight,
}: FilePaneProps) {
	return (
		<>
			{sessionStatus === "idle" && (
				<p className={styles.empty}>Choose a package and two versions.</p>
			)}
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
					className={styles.centered}
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
