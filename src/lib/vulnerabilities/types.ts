import type { LineAnchor } from "#/lib/diff/lineAnchor.ts";

export type OsvEcosystem = "npm" | "crates.io" | "Go" | "PyPI" | "Packagist";

export type Severity = "critical" | "high" | "moderate" | "low" | "unknown";

export interface FixCommit {
	owner: string;
	repo: string;
	sha: string;
}

export interface GoImport {
	path: string;
	symbols: string[];
}

export interface AdvisoryHints {
	goImports: GoImport[];
	functions: string[];
	fixCommits: FixCommit[];
}

export interface Advisory {
	id: string;
	aliases: string[];
	summary: string;
	severity: Severity;
	url: string;
	fixedIn: string[];
	hints: AdvisoryHints;
}

export type AdvisoryChange = "introduced" | "remaining" | "fixed";

export interface ReportEntry {
	advisory: Advisory;
	change: AdvisoryChange;
}

export interface VulnerabilityReport {
	fromCount: number;
	toCount: number;
	entries: ReportEntry[];
}

export interface CommitFile {
	filename: string;
	removedLines: string[];
	addedLines: string[];
}

export interface AffectedFile {
	path: string;
	advisoryIds: string[];
	symbols: string[];
	removedLines: string[];
	addedLines: string[];
}

export interface LineMark {
	anchor: LineAnchor;
	advisoryIds: string[];
}
