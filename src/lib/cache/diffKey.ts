export interface DiffKey {
	schema: number;
	engine: string;
	registry: string;
	package: string;
	from: string;
	to: string;
	similarityThreshold: number;
	ignoreWhitespace: boolean;
}

const THRESHOLD_DECIMALS = 4;

export function canonicalString(key: DiffKey): string {
	const text = JSON.stringify;
	return (
		`{"engine":${text(key.engine)},"from":${text(key.from)},` +
		`"ignore_whitespace":${key.ignoreWhitespace},"package":${text(key.package)},` +
		`"registry":${text(key.registry)},"schema":${key.schema},` +
		`"similarity_threshold":${text(key.similarityThreshold.toFixed(THRESHOLD_DECIMALS))},` +
		`"to":${text(key.to)}}`
	);
}

export async function diffId(key: DiffKey): Promise<string> {
	const bytes = new TextEncoder().encode(canonicalString(key));
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
}
