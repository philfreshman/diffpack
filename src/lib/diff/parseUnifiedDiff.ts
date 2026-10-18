import type { FileDiff } from "#/lib/worker/protocol.ts";

export interface DiffLine {
	type: "added" | "removed" | "unchanged";
	content: string;
	oldNumber: number | null;
	newNumber: number | null;
}

export function parseUnifiedDiff(file: FileDiff): DiffLine[] {
	const raws = file.data.split("\n");
	if (!file.isDiff) {
		return raws.map((content, index) => ({
			type: "unchanged" as const,
			content,
			oldNumber: index + 1,
			newNumber: index + 1,
		}));
	}

	const lines: DiffLine[] = [];
	let oldNumber = 0;
	let newNumber = 0;

	for (const raw of raws) {
		if (isHeader(raw)) continue;

		if (raw.startsWith("- ")) {
			lines.push({
				type: "removed",
				content: raw.slice(2),
				oldNumber: ++oldNumber,
				newNumber: null,
			});
		} else if (raw.startsWith("+ ")) {
			lines.push({
				type: "added",
				content: raw.slice(2),
				oldNumber: null,
				newNumber: ++newNumber,
			});
		} else {
			lines.push({
				type: "unchanged",
				content: raw.slice(2),
				oldNumber: ++oldNumber,
				newNumber: ++newNumber,
			});
		}
	}

	return lines;
}

function isHeader(raw: string): boolean {
	return (
		raw.startsWith("--- from/") ||
		raw.startsWith("+++ to/") ||
		raw === "--- /dev/null" ||
		raw === "+++ /dev/null"
	);
}
