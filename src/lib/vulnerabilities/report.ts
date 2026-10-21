import { sameVulnerability } from "./aliases.ts";
import { severityRank } from "./severity.ts";
import type {
	Advisory,
	AdvisoryChange,
	ReportEntry,
	VulnerabilityReport,
} from "./types.ts";

const CHANGE_ORDER: readonly AdvisoryChange[] = [
	"introduced",
	"remaining",
	"fixed",
];

export function compareAdvisories(
	from: Advisory[],
	to: Advisory[],
): VulnerabilityReport {
	const inFrom = (advisory: Advisory) =>
		from.some((old) => sameVulnerability(old, advisory));
	const inTo = (advisory: Advisory) =>
		to.some((current) => sameVulnerability(current, advisory));

	const entries: ReportEntry[] = [
		...to.map((advisory) => ({
			advisory,
			change: inFrom(advisory)
				? ("remaining" as const)
				: ("introduced" as const),
		})),
		...from
			.filter((advisory) => !inTo(advisory))
			.map((advisory) => ({ advisory, change: "fixed" as const })),
	];

	return {
		fromCount: from.length,
		toCount: to.length,
		entries: entries.sort(byReportOrder),
	};
}

function byReportOrder(a: ReportEntry, b: ReportEntry): number {
	return (
		CHANGE_ORDER.indexOf(a.change) - CHANGE_ORDER.indexOf(b.change) ||
		severityRank(b.advisory.severity) - severityRank(a.advisory.severity) ||
		a.advisory.id.localeCompare(b.advisory.id)
	);
}
