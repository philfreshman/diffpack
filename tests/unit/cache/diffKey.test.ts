import { describe, expect, test } from "bun:test";
import { canonicalString, type DiffKey, diffId } from "#/lib/cache/diffKey.ts";
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
