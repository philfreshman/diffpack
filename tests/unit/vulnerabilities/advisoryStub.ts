import type {
	Advisory,
	AdvisoryHints,
	ReportEntry,
} from "#/lib/vulnerabilities/types.ts";

export function advisory(
	fields: Partial<Omit<Advisory, "hints">> & {
		id: string;
		hints?: Partial<AdvisoryHints>;
	},
): Advisory {
	return {
		aliases: [],
		summary: "",
		severity: "unknown",
		url: `https://osv.dev/vulnerability/${fields.id}`,
		fixedIn: [],
		...fields,
		hints: { goImports: [], functions: [], fixCommits: [], ...fields.hints },
	};
}

export function introduced(
	fields: Parameters<typeof advisory>[0],
): ReportEntry {
	return { advisory: advisory(fields), change: "introduced" };
}
