import { commitKey } from "./affectedFiles.ts";
import { fixCommitOf } from "./fixCommitReference.ts";
import {
	arrayOf,
	isPresent,
	type JsonObject,
	objectOf,
	stringOf,
	stringsOf,
	unique,
	uniqueBy,
} from "./json.ts";
import { severityOf } from "./severity.ts";
import type { Advisory, FixCommit, GoImport, OsvPackage } from "./types.ts";

const OSV_VULNERABILITY_URL = "https://osv.dev/vulnerability";
const VERSION_RANGE_TYPES = new Set(["SEMVER", "ECOSYSTEM"]);
const SUMMARY_LIMIT = 200;
const PYPI_ECOSYSTEM = "PyPI";
const PYPI_NAME_SEPARATORS = /[-_.]+/g;

export function advisoryFrom(record: unknown, queried: OsvPackage): Advisory {
	const fields = objectOf(record);
	const id = stringOf(fields.id);
	const affected = affectedEntriesFor(fields.affected, queried);

	return {
		id,
		aliases: stringsOf(fields.aliases).filter((alias) => alias !== id),
		summary: summaryOf(fields),
		severity: severityOf(stringOf(objectOf(fields.database_specific).severity)),
		url: `${OSV_VULNERABILITY_URL}/${encodeURIComponent(id)}`,
		fixedIn: unique(affected.flatMap(fixedVersionsOf)),
		hints: {
			goImports: affected.flatMap(goImportsOf),
			functions: unique(affected.flatMap(functionsOf)),
			fixCommits: fixCommitsOf(fields.references),
		},
	};
}

function comparableName(name: string, ecosystem: string): string {
	const lowered = name.toLowerCase();
	if (ecosystem !== PYPI_ECOSYSTEM) return lowered;
	return lowered.replace(PYPI_NAME_SEPARATORS, "-");
}

function affectedEntriesFor(
	affected: unknown,
	queried: OsvPackage,
): JsonObject[] {
	return arrayOf(affected)
		.map(objectOf)
		.filter((entry) => {
			const target = objectOf(entry.package);
			return (
				stringOf(target.ecosystem) === queried.ecosystem &&
				comparableName(stringOf(target.name), queried.ecosystem) ===
					comparableName(queried.name, queried.ecosystem)
			);
		});
}

function summaryOf(fields: JsonObject): string {
	const summary = stringOf(fields.summary).trim();
	if (summary !== "") return summary;
	const firstLine = stringOf(fields.details).trim().split("\n")[0] ?? "";
	if (firstLine.length <= SUMMARY_LIMIT) return firstLine;
	return `${firstLine.slice(0, SUMMARY_LIMIT).trimEnd()}…`;
}

function fixedVersionsOf(entry: JsonObject): string[] {
	return arrayOf(entry.ranges)
		.map(objectOf)
		.filter((range) => VERSION_RANGE_TYPES.has(stringOf(range.type)))
		.flatMap((range) => arrayOf(range.events))
		.map((event) => stringOf(objectOf(event).fixed))
		.filter((version) => version !== "");
}

function goImportsOf(entry: JsonObject): GoImport[] {
	return arrayOf(objectOf(entry.ecosystem_specific).imports)
		.map(objectOf)
		.map((item) => ({
			path: stringOf(item.path),
			symbols: stringsOf(item.symbols),
		}))
		.filter((item) => item.path !== "");
}

function functionsOf(entry: JsonObject): string[] {
	const affects = objectOf(objectOf(entry.ecosystem_specific).affects);
	return stringsOf(affects.functions);
}

function fixCommitsOf(references: unknown): FixCommit[] {
	const commits = arrayOf(references)
		.map((reference) => fixCommitOf(stringOf(objectOf(reference).url)))
		.filter(isPresent);
	return uniqueBy(commits, commitKey);
}
