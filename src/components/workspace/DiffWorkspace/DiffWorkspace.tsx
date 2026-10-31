import { useStateResetOn } from "#/components/lifecycle/useStateResetOn.ts";
import { DiffToolbar } from "#/components/diff/DiffToolbar/DiffToolbar.tsx";
import { DiffView } from "#/components/diff/DiffView/DiffView.tsx";
import type { FileModelControls } from "#/components/diff/useFileModel.ts";
import type { HighlightThemeControls } from "#/components/diff/useHighlightTheme.ts";
import {
	FileStream,
	type FileStreamProps,
} from "#/components/review/FileStream/FileStream.tsx";
import { FileHeader } from "#/components/review/FileHeader/FileHeader.tsx";
import type { ViewedFiles } from "#/components/review/useViewedFiles.ts";
import { TreePanel } from "#/components/tree/TreePanel/TreePanel.tsx";
import { Spinner } from "#/components/ui/Spinner/Spinner.tsx";
import { useKeyShortcut } from "#/components/ui/useKeyShortcut.ts";
import type { BuildProgress } from "#/lib/session/buildProgress.ts";
import {
	type DiffSessionState,
	diffSession,
	type OpenFile,
} from "#/lib/session/diffSession.ts";
import { findFile, type TreeSummary } from "#/lib/session/tree.ts";
import { type DiffSlug, namesComparison } from "#/lib/url/slug.ts";
import { workspaceIntro } from "#/lib/url/workspaceIntro.ts";
import type { DiffFileEntry } from "#/lib/worker/protocol.ts";
import { AsciiTrail } from "../AsciiTrail/AsciiTrail.tsx";
import { DiffProgress } from "../DiffProgress/DiffProgress.tsx";
import { DiffSummary } from "../DiffSummary/DiffSummary.tsx";
import { FailureNotice } from "../FailureNotice/FailureNotice.tsx";
import type { LineLink } from "../useLineLink.ts";
import type { VulnerabilityFindings } from "../useVulnerabilities.ts";
import { VulnerabilityNotice } from "../VulnerabilityNotice/VulnerabilityNotice.tsx";
import { VulnerabilityReport } from "../VulnerabilityReport/VulnerabilityReport.tsx";
import { WorkspaceHeader } from "../WorkspaceHeader/WorkspaceHeader.tsx";
import styles from "./DiffWorkspace.module.css";
import { useWorkspace, type Workspace } from "./useWorkspace.ts";

export function DiffWorkspace({ slug }: { slug: DiffSlug }) {
	const workspace = useWorkspace(slug);
	const { session, links, files, review, versionsFailure, pane } = workspace;

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
			<WorkspaceHeader slug={slug} />
			<div className={styles.panes}>
				<TreePanel
					tree={session.tree}
					comparison={links.comparisonPath}
					selectedPath={files.selectedPath}
					onOpenFile={files.showFile}
					viewedPaths={review.viewed}
				/>
				<main className={styles.body}>
					{versionsFailure && pane !== "progress" && (
						<FailureNotice
							{...versionsFailure}
							testId="versions-error"
							centered={pane === "versions-failure"}
						/>
					)}

					{pane !== "versions-failure" && (
						<ComparisonSection workspace={workspace} />
					)}
				</main>
			</div>
		</div>
	);
}

function ComparisonSection({ workspace }: { workspace: Workspace }) {
	const { slug, adapter, session, links, files, progress, summary } = workspace;

	return (
		<section className={styles.file} data-testid="diff-file">
			<WorkspaceToolbar workspace={workspace} />
			{showsIntro(session.status) && (
				<p className={styles.intro} data-testid="workspace-intro">
					{workspaceIntro(adapter, slug)}
				</p>
			)}
			{!files.streaming &&
				showsTrail(session.status, slug, progress, summary) && <AsciiTrail />}
			<ComparisonPane
				slug={slug}
				progress={progress}
				summary={summary}
				streaming={files.streaming}
				stream={streamOf(workspace)}
				file={session.file}
				highlight={workspace.highlight}
				showSigns={workspace.viewer.signs.value}
				autohideScrollbar={workspace.viewer.autohide.value}
				lineLink={workspace.lineLink}
				onClose={links.closeFile}
				shown={workspace.shown}
				tree={session.tree}
				review={workspace.review}
				vulnerabilities={workspace.vulnerabilities}
				fileLink={links.fileLink}
			/>
		</section>
	);
}

function WorkspaceToolbar({ workspace }: { workspace: Workspace }) {
	const { files, changed, shown, highlight } = workspace;
	const { whitespace, split, signs, autohide } = workspace.viewer;

	return (
		<DiffToolbar
			path={files.currentPath}
			fileIndex={files.currentIndex}
			fileCount={changed.length}
			onStepFile={files.stepFile}
			file={shown}
			split={split.value}
			onSplitChange={split.set}
			layout={files.shownLayout}
			onLayoutChange={files.changeLayout}
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
	);
}

function streamOf({
	files,
	changed,
	review,
	links,
	viewer,
}: Workspace): StreamProps {
	return {
		streamRef: files.streamRef,
		files: changed,
		readFile: diffSession.readFile,
		viewed: review.viewed,
		onViewedChange: review.setViewed,
		onCurrentFileChange: files.onCurrentFileChange,
		onOpenFile: links.openFile,
		onSelectLine: links.selectStreamLine,
		split: viewer.split.value,
	};
}

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

type StreamProps = Omit<
	FileStreamProps,
	"showSigns" | "autohideScrollbar" | "highlightTheme"
>;

interface ComparisonPaneProps extends FilePaneProps {
	slug: DiffSlug;
	progress: BuildProgress | null;
	summary: TreeSummary | null;
	streaming: boolean;
	stream: StreamProps;
	fileLink(path: string): string;
}

function ComparisonPane({
	slug,
	progress,
	summary,
	streaming,
	stream,
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
	if (summary && streaming)
		return (
			<FileStream
				{...stream}
				showSigns={filePane.showSigns}
				autohideScrollbar={filePane.autohideScrollbar}
				highlightTheme={filePane.highlight.theme}
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
	tree: DiffFileEntry | null;
	review: ViewedFiles;
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
	tree,
	review,
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
					<SingleFile
						shown={shown}
						key={shown.path}
						entry={findFile(tree, shown.path)}
						review={review}
						onClose={onClose}
						pending={file?.status === "loading"}
						showSigns={showSigns}
						autohideScrollbar={autohideScrollbar}
						lineLink={lineLink}
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

interface SingleFileProps {
	shown: FileModelControls;
	entry: DiffFileEntry | undefined;
	review: ViewedFiles;
	onClose(): void;
	pending: boolean;
	showSigns: boolean;
	autohideScrollbar: boolean;
	lineLink: LineLink;
	highlightTheme: string | null;
}

function SingleFile({
	shown,
	entry,
	review,
	onClose,
	pending,
	showSigns,
	autohideScrollbar,
	lineLink,
	highlightTheme,
}: SingleFileProps) {
	const viewed = review.viewed.has(shown.path);
	const [open, setOpen] = useStateResetOn(() => !viewed, [viewed]);
	useKeyShortcut("v", () => review.setViewed(shown.path, !viewed));

	return (
		<DiffView
			file={shown}
			header={
				entry && (
					<FileHeader
						entry={entry}
						expandAll={shown.rows.length > 0 ? shown.expandAll : null}
						onClose={onClose}
						onExpandAllChange={shown.setExpandAll}
						onOpenChange={setOpen}
						onViewedChange={(isViewed) =>
							review.setViewed(shown.path, isViewed)
						}
						open={open}
						viewed={viewed}
					/>
				)
			}
			folded={!open}
			onClose={onClose}
			pending={pending}
			showSigns={showSigns}
			autohideScrollbar={autohideScrollbar}
			anchor={lineLink.anchorIn(shown.path)}
			onSelectLine={lineLink.select}
			highlightTheme={highlightTheme}
		/>
	);
}
