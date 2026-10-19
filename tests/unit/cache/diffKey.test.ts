import { describe, expect, test } from "bun:test";
import {
	canonicalString,
	comparisonDiffKey,
	type DiffKey,
	diffId,
} from "#/lib/cache/diffKey.ts";
import vectorFile from "../../../fixtures/cache-key-vectors.json" with {
	type: "json",
};

type VectorInput = (typeof vectorFile.vectors)[number]["input"];

function keyOf(input: VectorInput): DiffKey {
	return {
		schema: input.schema,
		engine: input.engine,
		registry: input.registry,
		package: input.package,
		from: input.from,
		to: input.to,
		similarityThreshold: input.similarity_threshold,
		ignoreWhitespace: input.ignore_whitespace,
	};
}

describe("the diff cache key, held to the server's vectors", () => {
	for (const vector of vectorFile.vectors) {
		test(`${vector.name}: canonical string`, () => {
			expect(canonicalString(keyOf(vector.input))).toBe(vector.canonical);
		});

		test(`${vector.name}: diff_id`, async () => {
			expect(await diffId(keyOf(vector.input))).toBe(vector.diff_id);
		});
	}
});

const zod = {
	registry: "npm",
	pkg: "zod",
	from: "3.25.76",
	to: "4.0.0",
	ignoreWhitespace: false,
};

function vectorNamed(name: string) {
	const vector = vectorFile.vectors.find((each) => each.name === name);
	if (!vector) throw new Error(`no vector named ${name}`);
	return vector;
}

async function installedEngineVersion(): Promise<string> {
	const manifest = await Bun.file(
		"node_modules/@philfreshman/diffpack-engine/package.json",
	).json();
	return manifest.version;
}

describe("the key of a comparison the app makes", () => {
	test("is the server's key for the same comparison at the same engine", async () => {
		expect(await diffId(comparisonDiffKey(zod, "0.4.1"))).toBe(
			vectorNamed("npm/zod at engine 0.4.1").diff_id,
		);
	});

	test("names the engine the app has installed", async () => {
		expect(comparisonDiffKey(zod).engine).toBe(await installedEngineVersion());
	});

	test("changes when the engine does", async () => {
		expect(await diffId(comparisonDiffKey(zod, "0.3.0"))).toBe(
			vectorNamed("npm/zod").diff_id,
		);
		expect(await diffId(comparisonDiffKey(zod, "0.4.0"))).toBe(
			vectorNamed("engine version participates").diff_id,
		);
	});
});
