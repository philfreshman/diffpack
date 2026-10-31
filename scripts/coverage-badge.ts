import { $ } from "bun";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BADGE_PATH = ".github/badges/coverage.svg";
const MEASURED_SOURCE = "src/";
const GENERATED_SUFFIX = ".gen.ts";
const LABEL = "coverage";

const PADDING_BOTH_SIDES = 10;
const AVERAGE_CHARACTER_WIDTH = 7;
const VERDANA_11PX_WIDTHS: Readonly<Record<string, number>> = {
	"0": 7,
	"1": 7,
	"2": 7,
	"3": 7,
	"4": 7,
	"5": 7,
	"6": 7,
	"7": 7,
	"8": 7,
	"9": 7,
	"%": 11.9,
	a: 6.7,
	c: 6,
	e: 6.6,
	g: 6.8,
	o: 6.8,
	r: 4.7,
	v: 6.5,
};

const COLOUR_THRESHOLDS: readonly { minimum: number; colour: string }[] = [
	{ minimum: 95, colour: "#4c1" },
	{ minimum: 90, colour: "#97ca00" },
	{ minimum: 75, colour: "#a4a61d" },
	{ minimum: 60, colour: "#dfb317" },
	{ minimum: 40, colour: "#fe7d37" },
];
const BELOW_EVERY_THRESHOLD_COLOUR = "#e05d44";

interface LineTotals {
	found: number;
	hit: number;
}

async function unitTestLcov(): Promise<string> {
	const coverageDir = await mkdtemp(join(tmpdir(), "diffpack-coverage-"));
	try {
		const run =
			await $`bun test tests/unit --coverage --coverage-reporter=lcov --coverage-dir=${coverageDir}`
				.quiet()
				.nothrow();
		if (run.exitCode !== 0) {
			console.error(run.stderr.toString());
			throw new Error("the unit tests failed, so coverage was not measured");
		}
		return await Bun.file(join(coverageDir, "lcov.info")).text();
	} finally {
		await rm(coverageDir, { recursive: true, force: true });
	}
}

function isMeasured(path: string): boolean {
	return path.startsWith(MEASURED_SOURCE) && !path.endsWith(GENERATED_SUFFIX);
}

function sourceLineTotals(lcov: string): LineTotals {
	const totals: LineTotals = { found: 0, hit: 0 };
	let measured = false;

	for (const line of lcov.split("\n")) {
		const [field, value = ""] = line.split(":", 2);
		if (field === "SF") measured = isMeasured(value);
		else if (measured && field === "LF") totals.found += Number(value);
		else if (measured && field === "LH") totals.hit += Number(value);
	}

	if (totals.found === 0)
		throw new Error(
			`the coverage report has no lines under ${MEASURED_SOURCE}`,
		);
	return totals;
}

function wholePercent({ found, hit }: LineTotals): number {
	return Math.floor((hit / found) * 100);
}

function colourFor(percent: number): string {
	const threshold = COLOUR_THRESHOLDS.find(({ minimum }) => percent >= minimum);
	return threshold?.colour ?? BELOW_EVERY_THRESHOLD_COLOUR;
}

function textWidth(text: string): number {
	const width = [...text].reduce(
		(sum, character) =>
			sum + (VERDANA_11PX_WIDTHS[character] ?? AVERAGE_CHARACTER_WIDTH),
		0,
	);
	return Math.round(width);
}

function badgeSvg(percent: number): string {
	const value = `${percent}%`;
	const labelTextWidth = textWidth(LABEL);
	const valueTextWidth = textWidth(value);
	const labelWidth = labelTextWidth + PADDING_BOTH_SIDES;
	const valueWidth = valueTextWidth + PADDING_BOTH_SIDES;
	const width = labelWidth + valueWidth;
	const labelCentre = labelWidth * 5;
	const valueCentre = (labelWidth + valueWidth / 2) * 10;
	const title = `${LABEL}: ${value}`;

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${title}">
<title>${title}</title>
<linearGradient id="s-coverage" x2="0" y2="100%">
<stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
<stop offset="1" stop-opacity=".1"/>
</linearGradient>
<clipPath id="r-coverage">
<rect width="${width}" height="20" rx="3" fill="#fff"/>
</clipPath>
<g clip-path="url(#r-coverage)">
<rect width="${labelWidth}" height="20" fill="#555"/>
<rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${colourFor(percent)}"/>
<rect width="${width}" height="20" fill="url(#s-coverage)"/>
</g>
<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
<text aria-hidden="true" x="${labelCentre}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${labelTextWidth * 10}">${LABEL}</text>
<text x="${labelCentre}" y="140" transform="scale(.1)" fill="#fff" textLength="${labelTextWidth * 10}">${LABEL}</text>
<text aria-hidden="true" x="${valueCentre}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${valueTextWidth * 10}">${value}</text>
<text x="${valueCentre}" y="140" transform="scale(.1)" fill="#fff" textLength="${valueTextWidth * 10}">${value}</text>
</g>
</svg>
`;
}

async function checkCommittedBadge(expected: string): Promise<void> {
	const committed = await Bun.file(BADGE_PATH).text();
	if (committed === expected) return;

	console.error(
		`${BADGE_PATH} is out of date. Run \`bun run badge:coverage\` and commit the result.`,
	);
	process.exitCode = 1;
}

const percent = wholePercent(sourceLineTotals(await unitTestLcov()));
const svg = badgeSvg(percent);

if (process.argv.includes("--check")) await checkCommittedBadge(svg);
else {
	await Bun.write(BADGE_PATH, svg);
	console.log(`Line coverage of ${MEASURED_SOURCE}: ${percent}%`);
}
