import { useNavigate } from "@tanstack/react-router";
import { useFileModel } from "#/components/diff/useFileModel.ts";
import { useHighlightTheme } from "#/components/diff/useHighlightTheme.ts";
import { useViewedFiles } from "#/components/review/useViewedFiles.ts";
import { formatLineAnchor, type LineAnchor } from "#/lib/diff/lineAnchor.ts";
import { failureOf } from "#/lib/failure/failure.ts";
import { requireAdapter } from "#/lib/registries/index.ts";
import type { RegistryAdapter } from "#/lib/registries/types.ts";
import {
	BUILT,
	type BuildProgress,
	FETCHING,
} from "#/lib/session/buildProgress.ts";
import type { DiffSessionState } from "#/lib/session/diffSession.ts";
import {
	changedFiles,
	summarizeTree,
	type TreeSummary,
} from "#/lib/session/tree.ts";
import { buildPath, type DiffSlug, namesComparison } from "#/lib/url/slug.ts";
import type { DiffFileEntry, DiffRequest } from "#/lib/worker/protocol.ts";
import { useDiffSession } from "../useDiffSession.ts";
import { useFileNavigation } from "../useFileNavigation.ts";
import { useLineLink } from "../useLineLink.ts";
import { useVersions } from "../useVersions.ts";
import { useViewerSettings } from "../useViewerSettings.ts";
import {
	type ScanStatus,
	useVulnerabilityFindings,
} from "../useVulnerabilities.ts";

type Pane = "progress" | "versions-failure" | "file";

export type Workspace = ReturnType<typeof useWorkspace>;

export function useWorkspace(slug: DiffSlug) {
	const adapter = requireAdapter(slug.registry);
	const links = useWorkspaceLinks(adapter, slug);
	const viewer = useViewerSettings();
	// One instance for the toolbar and the viewer; a second would be a second answer.
	const highlight = useHighlightTheme();
	// null until the stored value is read, or a deep link would build a
	// whitespace-exact tree first and then throw it away.
	const session = useDiffSession(
		slug,
		viewer.whitespace.known ? viewer.whitespace.value : null,
	);
	// The arrows skip unchanged files, which the tree hides by default.
	const changed = changedFiles(session.tree);

	// The header's list, shared through the query cache: no second request.
	const versions = useVersions(adapter, slug.package);
	const vulnerabilities = useVulnerabilityFindings(slug, readyTree(session));

	const lineLink = useLineLink(adapter, slug);
	// What is on screen, not what was last asked for: it lags while the blur shows.
	const shown = useFileModel(session.key, session.file, viewer.split.value);

	const versionsFailure = versions.error && failureOf(versions.error);
	const progress = shownProgress(session, slug, vulnerabilities.scan.status);
	const summary = shownSummary(session);
	const pane = paneOf(session.status, progress, versionsFailure !== null);

	const review = useViewedFiles(reviewedRequest(slug, session));
	const files = useFileNavigation({
		changed,
		// From the session, not the URL: a file is open only once its tree is ready.
		session,
		urlPath: slug.file,
		summaryShown: summary !== null,
		layout: viewer.layout,
		openFile: links.openFile,
		closeFile: links.closeFile,
	});

	return {
		slug,
		adapter,
		links,
		viewer,
		highlight,
		session,
		changed,
		vulnerabilities,
		lineLink,
		shown,
		versionsFailure,
		progress,
		summary,
		pane,
		review,
		files,
	};
}

function useWorkspaceLinks(adapter: RegistryAdapter, slug: DiffSlug) {
	const navigate = useNavigate();
	// Unlike `session.key`, this holds still when whitespace is toggled.
	const comparisonPath = buildPath(adapter, { ...slug, file: "" });

	function fileLink(file: string): string {
		return buildPath(adapter, { ...slug, file });
	}

	function openFile(file: string) {
		navigate({ to: fileLink(file) });
	}

	function closeFile() {
		navigate({ to: comparisonPath });
	}

	function selectStreamLine(file: string, anchor: LineAnchor) {
		navigate({ to: fileLink(file), hash: formatLineAnchor(anchor) });
	}

	return { comparisonPath, fileLink, openFile, closeFile, selectStreamLine };
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

function reviewedRequest(
	slug: DiffSlug,
	session: DiffSessionState,
): DiffRequest | null {
	if (session.status !== "ready") return null;
	const { registry, package: pkg, from, to } = slug;

	return { registry, pkg, from, to };
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
