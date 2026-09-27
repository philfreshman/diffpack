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
import { requireAdapter } from "#/lib/registries/index.ts";
import type { DiffSessionState, OpenFile } from "#/lib/session/diffSession.ts";
import { changedFiles, flattenFiles } from "#/lib/session/tree.ts";
import { IGNORE_WHITESPACE, SPLIT_VIEW } from "#/lib/storage/settings.ts";
import { buildPath, type DiffSlug } from "#/lib/url/slug.ts";
import { RegistrySwitcher } from "../RegistrySwitcher/RegistrySwitcher.tsx";
import { useDiffSession } from "../useDiffSession.ts";
import { WorkspaceHeader } from "../WorkspaceHeader/WorkspaceHeader.tsx";
import styles from "./DiffWorkspace.module.css";

/**
 * The workspace shell: the sidebar navigates a comparison down the left of the
 * window, and beside it the header assembles one and the body shows the one
 * the URL already names.
 *
 * The tree and the toolbar are the body's frame, not the comparison's — they
 * stand from the first paint, empty and stood down, so that choosing a package
 * fills a layout the reader is already looking at rather than replacing one.
 *
 * Opening a file is a URL write like any other navigation. The file on screen
 * is one model, held here rather than in the viewer: the toolbar reads it too,
 * and the viewer is mounted per file while how much of each file is open has
 * to survive clicking through the tree and back.
 *
 * What each of the two panels shows while the comparison is still arriving is
 * that panel's own business, and is answered below rather than here: this
 * function assembles the frame and leaves the states to `TreeStatus` and
 * `FilePane`.
 */
export function DiffWorkspace({ slug }: { slug: DiffSlug }) {
	const adapter = requireAdapter(slug.registry);
	const navigate = useNavigate();
	// Whether whitespace counts as a change is a reading habit, like split view
	// and the highlight theme, so it is remembered rather than asked per file.
	const whitespace = useSetting(IGNORE_WHITESPACE);
	// Held here rather than in the gear that changes it: the viewer takes its
	// own surfaces from the same choice, and a second copy of the hook would be
	// a second answer to one question.
	const highlight = useHighlightTheme();
	// No answer rather than the fallback until the stored one is read: a deep
	// link opened with the setting on would otherwise build the whole tree
	// whitespace-exact first and immediately throw it away.
	const session = useDiffSession(
		slug,
		whitespace.known ? whitespace.value : null,
	);
	const files = flattenFiles(session.tree);
	// The files the toolbar's arrows walk: the unchanged ones are what the tree
	// hides by default, and stepping into one would look like a broken button.
	const changed = changedFiles(session.tree);
	// Where the open file sits among them, as the session has it rather than as
	// the URL names it: a file is only open once its tree is there to hold it.
	const fileIndex = changed.findIndex(
		(entry) => entry.path === session.file?.path,
	);

	// Which layout a diff is read in is a habit, not a decision to make again
	// per file: the toolbar stores it as it flips it, and the model lays the
	// file's rows out by it.
	const split = useSetting(SPLIT_VIEW);
	// The file on screen, as the one model the toolbar and the viewer both
	// read. It is what is on screen rather than what was last asked for, so
	// the count changes when the blur clears rather than a moment before it.
	const shown = useFileModel(session.key, session.file, split.value);
	// The comparison the URL names, as its address without a file: registry,
	// package and both versions. Unlike the session's key it holds still while
	// whitespace is toggled, which rebuilds the same comparison.
	const comparisonPath = buildPath(adapter, { ...slug, file: "" });

	// Opening a file is a URL write like any other navigation; the session
	// follows the address, never the click.
	function openFile(file: string) {
		navigate({ to: buildPath(adapter, { ...slug, file }) });
	}

	/** Closing a file is the same write with nothing in the file segment. */
	function closeFile() {
		navigate({ to: comparisonPath });
	}

	/** The file before or after this one, in the order the tree lists them. */
	function stepFile(direction: 1 | -1) {
		const next = changed[fileIndex + direction];
		if (next) openFile(next.path);
	}

	return (
		// The parsed URL, stated on the shell: it is what the route hands down,
		// server-rendered, and the routing suite reads it here rather than from
		// controls whose values also depend on what a registry answered.
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
					{session.status === "error" && (
						<p className={styles.error} role="alert" data-testid="diff-error">
							{session.error}
						</p>
					)}

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
				</main>
			</div>
		</div>
	);
}

interface TreeStatusProps {
	status: DiffSessionState["status"];
	packageName: string;
	fileCount: number;
	changedCount: number;
}

/**
 * What state the comparison is in, said under the tree it describes. Empty
 * while there is nothing to say — the element stays, because what state the
 * comparison is in is read off it.
 */
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
	/** Where the comparison as a whole has got to. */
	sessionStatus: DiffSessionState["status"];
	/** The file the URL names, or `null` when it names none. */
	file: OpenFile | null;
	/** The file actually on screen, which the blur keeps a step behind. */
	shown: FileModelControls | null;
	onClose(): void;
	/** Which theme the code is coloured with, and on what ground. */
	highlight: HighlightThemeControls;
}

/**
 * Under the toolbar: nothing asked for yet, a file on its way, a file that
 * failed, or the file itself.
 */
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
			{/* Only with nothing to blur: the first file of a comparison has no
			    predecessor to keep on screen. */}
			{file?.status === "loading" && !shown && (
				<Spinner label={`Loading ${file.path}…`} />
			)}
			{file?.status === "error" && (
				<p role="alert" data-testid="file-error">
					{file.error}
				</p>
			)}
			{shown && (
				// Keyed by path: a new file is a new view, which is what makes
				// restoring its scroll a plain mount effect.
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
