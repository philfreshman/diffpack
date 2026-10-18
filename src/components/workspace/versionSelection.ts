export interface VersionSelection {
	from: string;
	to: string;
}

// A URL version wins whenever the list contains it, so a shared link is never
// silently changed. A one-version package compares against itself.
export function resolveSelection(
	versions: readonly string[],
	url: Partial<VersionSelection>,
): VersionSelection {
	if (versions.length === 0) {
		return { from: url.from ?? "", to: url.to ?? "" };
	}

	const known = (version: string | undefined): version is string =>
		version !== undefined && versions.includes(version);

	return {
		from: known(url.from) ? url.from : (versions[1] ?? versions[0] ?? ""),
		to: known(url.to) ? url.to : (versions[0] ?? ""),
	};
}
