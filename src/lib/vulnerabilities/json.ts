export type JsonObject = Record<string, unknown>;

export function objectOf(value: unknown): JsonObject {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return {};
	}
	return value as JsonObject;
}

export function arrayOf(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

export function stringOf(value: unknown): string {
	return typeof value === "string" ? value : "";
}

export function stringsOf(value: unknown): string[] {
	return arrayOf(value).filter(
		(item): item is string => typeof item === "string" && item !== "",
	);
}

export function unique<T>(items: Iterable<T>): T[] {
	return [...new Set(items)];
}

export function uniqueBy<T>(
	items: Iterable<T>,
	keyOf: (item: T) => string,
): T[] {
	const byKey = new Map<string, T>();
	for (const item of items) {
		const key = keyOf(item);
		if (!byKey.has(key)) byKey.set(key, item);
	}
	return [...byKey.values()];
}

export function isPresent<T>(item: T | null | undefined): item is T {
	return item !== null && item !== undefined;
}

export function groupBy<T>(
	items: Iterable<T>,
	keyOf: (item: T) => string,
): Map<string, T[]> {
	const groups = new Map<string, T[]>();
	for (const item of items) {
		const key = keyOf(item);
		const group = groups.get(key);
		if (group) group.push(item);
		else groups.set(key, [item]);
	}
	return groups;
}
