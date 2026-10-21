import type { Severity } from "./types.ts";

const SEVERITY_NAMES: Record<string, Severity> = {
	CRITICAL: "critical",
	HIGH: "high",
	MODERATE: "moderate",
	MEDIUM: "moderate",
	LOW: "low",
};

const SEVERITY_ORDER: readonly Severity[] = [
	"unknown",
	"low",
	"moderate",
	"high",
	"critical",
];

export function severityOf(name: string): Severity {
	return SEVERITY_NAMES[name.toUpperCase()] ?? "unknown";
}

export function severityRank(severity: Severity): number {
	return SEVERITY_ORDER.indexOf(severity);
}

export function moreSevere(a: Severity, b: Severity): Severity {
	return severityRank(b) > severityRank(a) ? b : a;
}
