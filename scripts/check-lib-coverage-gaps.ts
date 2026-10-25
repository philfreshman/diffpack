import { $ } from "bun";
import type { CoverageGaps, HealthOutput } from "fallow/types";

const SCOPE = "src/lib";

async function coverageGaps(): Promise<CoverageGaps> {
	const output: HealthOutput =
		await $`fallow health ${SCOPE} --coverage-gaps --format json --quiet`.json();
	if (!output.coverage_gaps)
		throw new Error("fallow's health report has no coverage_gaps section");

	return output.coverage_gaps;
}

function gapLines({ files = [], exports = [] }: CoverageGaps): string[] {
	return [
		...files.map((untested) => `- \`${untested.path}\``),
		...exports.map(
			(untested) =>
				`- \`${untested.path}:${untested.line}\` exports \`${untested.export_name}\``,
		),
	];
}

const gaps = await coverageGaps();
const lines = gapLines(gaps);

console.log(`## Coverage gaps in ${SCOPE}\n`);
if (lines.length === 0) {
	console.log(
		`Every one of its ${gaps.summary.runtime_files} runtime files and their exports is imported by a unit test.`,
	);
} else {
	console.log(
		"No unit test imports these, directly or through another module:\n",
	);
	console.log(lines.join("\n"));
	console.log(
		"\nAdd a test under tests/unit/, or, for a file no unit test can run, a `// fallow-ignore-file coverage-gaps -- <reason>` at its top.",
	);
	process.exitCode = 1;
}
