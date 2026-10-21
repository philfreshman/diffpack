import { commitKey } from "./affectedFiles.ts";
import { unique, uniqueBy } from "./json.ts";
import { moreSevere, severityRank } from "./severity.ts";
import type { Advisory, AdvisoryHints, GoImport } from "./types.ts";

function namesOf(advisory: Advisory): string[] {
	return [advisory.id, ...advisory.aliases];
}

export function sameVulnerability(a: Advisory, b: Advisory): boolean {
	const names = new Set(namesOf(a));
	return namesOf(b).some((name) => names.has(name));
}

export function collapseAliases(advisories: Advisory[]): Advisory[] {
	return advisories.reduce(withAdvisory, []);
}

function withAdvisory(collapsed: Advisory[], advisory: Advisory): Advisory[] {
	const isSame = (kept: Advisory) => sameVulnerability(kept, advisory);
	const first = collapsed.findIndex(isSame);
	if (first === -1) return [...collapsed, advisory];
	const joined = [...collapsed.filter(isSame), advisory].reduce(merged);
	return collapsed.flatMap((kept, index) => {
		if (index === first) return [joined];
		return isSame(kept) ? [] : [kept];
	});
}

function merged(kept: Advisory, duplicate: Advisory): Advisory {
	const [lead, other] =
		severityRank(duplicate.severity) > severityRank(kept.severity)
			? [duplicate, kept]
			: [kept, duplicate];

	return {
		...lead,
		aliases: unique([...namesOf(lead), ...namesOf(other)]).filter(
			(name) => name !== lead.id,
		),
		summary: lead.summary || other.summary,
		severity: moreSevere(lead.severity, other.severity),
		fixedIn: unique([...lead.fixedIn, ...other.fixedIn]),
		hints: mergedHints(lead.hints, other.hints),
	};
}

function mergedHints(a: AdvisoryHints, b: AdvisoryHints): AdvisoryHints {
	return {
		goImports: mergedGoImports([...a.goImports, ...b.goImports]),
		functions: unique([...a.functions, ...b.functions]),
		fixCommits: uniqueBy([...a.fixCommits, ...b.fixCommits], commitKey),
	};
}

function mergedGoImports(imports: GoImport[]): GoImport[] {
	const symbolsByPath = new Map<string, string[]>();
	for (const { path, symbols } of imports) {
		symbolsByPath.set(
			path,
			unique([...(symbolsByPath.get(path) ?? []), ...symbols]),
		);
	}
	return [...symbolsByPath].map(([path, symbols]) => ({ path, symbols }));
}
