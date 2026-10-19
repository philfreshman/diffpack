import { describe, expect, test } from "bun:test";
import { type DiffKey, diffId } from "#/lib/cache/diffKey.ts";

const SERVER = "https://mcp.diffpack.io/mcp";
const DIFF_TIMEOUT_MS = 60_000;

interface Asked {
	registry: string;
	package: string;
	from_version: string;
	to_version: string;
	similarity_threshold?: number;
	ignore_whitespace?: boolean;
}

interface HandleInputs {
	diff_id: string;
	schema: number;
	engine: string;
	registry: string;
	package: string;
	from: string;
	to: string;
	similarity_threshold: number;
	ignore_whitespace: boolean;
}

const comparisons: Asked[] = [
	{
		registry: "npm",
		package: "left-pad",
		from_version: "1.1.0",
		to_version: "1.1.3",
	},
	{
		registry: "npm",
		package: "@types/semver",
		from_version: "7.5.0",
		to_version: "7.5.8",
	},
	{
		registry: "npm",
		package: "left-pad",
		from_version: "1.1.3",
		to_version: "1.1.0",
		similarity_threshold: 0.12345,
		ignore_whitespace: true,
	},
	{
		registry: "npm",
		package: "left-pad",
		from_version: "1.1.0",
		to_version: "1.1.3",
		similarity_threshold: 1,
	},
	{
		registry: "pypi",
		package: "typing_extensions",
		from_version: "4.9.0",
		to_version: "4.12.0",
	},
	{
		registry: "pypi",
		package: "typing-extensions",
		from_version: "4.9.0",
		to_version: "4.12.0",
		similarity_threshold: 0.6123,
	},
	{
		registry: "crates",
		package: "itoa",
		from_version: "1.0.10",
		to_version: "1.0.11",
	},
];

async function compareOnTheServer(asked: Asked): Promise<HandleInputs> {
	const response = await fetch(SERVER, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			accept: "application/json, text/event-stream",
		},
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method: "tools/call",
			params: { name: "diff_package_versions", arguments: asked },
		}),
	});
	const answer = await response.json();
	const result = JSON.parse(answer.result.content[0].text);
	return decodeHandle(result.handle);
}

function decodeHandle(handle: string): HandleInputs {
	const [, payload = ""] = handle.split(":");
	return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

function keyOf(inputs: HandleInputs): DiffKey {
	return {
		schema: inputs.schema,
		engine: inputs.engine,
		registry: inputs.registry,
		package: inputs.package,
		from: inputs.from,
		to: inputs.to,
		similarityThreshold: inputs.similarity_threshold,
		ignoreWhitespace: inputs.ignore_whitespace,
	};
}

describe("the cache key, in Rust and in TypeScript", () => {
	for (const asked of comparisons) {
		const name = `${asked.registry}/${asked.package} ${asked.from_version}→${asked.to_version}`;

		test(
			`${name} gets one diff_id from both`,
			async () => {
				const inputs = await compareOnTheServer(asked);

				expect(inputs.package).toBe(asked.package);
				expect(await diffId(keyOf(inputs))).toBe(inputs.diff_id);
			},
			DIFF_TIMEOUT_MS,
		);
	}
});
