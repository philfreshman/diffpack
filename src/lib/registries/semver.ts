const CORE_PARTS = 3;

const NUMERIC_IDENTIFIER = /^\d+$/;

interface ParsedVersion {
	numbers: number[];
	preRelease: string[];
}

function parseVersion(version: string): ParsedVersion {
	// Build metadata ("+incompatible") plays no part in ordering.
	const [withoutBuild = ""] = version.replace(/^v/, "").split("+");
	const [core = "", ...preRelease] = withoutBuild.split("-");

	return {
		numbers: core.split(".").map((part) => Number.parseInt(part, 10) || 0),
		preRelease: preRelease.length > 0 ? preRelease.join("-").split(".") : [],
	};
}

function compareIdentifiers(a: string, b: string): number {
	const aIsNumber = NUMERIC_IDENTIFIER.test(a);
	const bIsNumber = NUMERIC_IDENTIFIER.test(b);
	if (aIsNumber && bIsNumber) return Number(a) - Number(b);
	if (aIsNumber) return -1;
	if (bIsNumber) return 1;
	return a < b ? -1 : a > b ? 1 : 0;
}

function comparePreReleases(a: string[], b: string[]): number {
	// A release outranks any pre-release of the same version.
	if (a.length === 0 || b.length === 0) return b.length - a.length;

	for (let i = 0; i < Math.min(a.length, b.length); i++) {
		const order = compareIdentifiers(a[i] ?? "", b[i] ?? "");
		if (order !== 0) return order;
	}

	return a.length - b.length;
}

function compareVersions(a: string, b: string): number {
	const left = parseVersion(a);
	const right = parseVersion(b);

	for (let i = 0; i < CORE_PARTS; i++) {
		const order = (left.numbers[i] ?? 0) - (right.numbers[i] ?? 0);
		if (order !== 0) return order;
	}

	return comparePreReleases(left.preRelease, right.preRelease);
}

export function compareVersionsDesc(a: string, b: string): number {
	return compareVersions(b, a);
}
