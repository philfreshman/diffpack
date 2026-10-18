import { describe, expect, test } from "bun:test";
import { createCratesAdapter } from "#/lib/registries/crates.ts";
import { createGoAdapter } from "#/lib/registries/go.ts";
import { createNpmAdapter } from "#/lib/registries/npm.ts";
import { createPypiAdapter } from "#/lib/registries/pypi.ts";
import type { Fetcher, RegistryAdapter } from "#/lib/registries/types.ts";
import { json, stubFetch, text } from "./fetchStub.ts";

// Asserts the SSRF triage (#111, docs/security-candidates.md): a name is appended to a constant origin, never resolved with `new URL(name, BASE)`.
const ALLOWED_ORIGINS: Record<string, string[]> = {
	npm: ["https://registry.npmjs.org"],
	crates: ["https://crates.io", "https://static.crates.io"],
	pypi: [
		"https://api.diffpack.io",
		"https://api.deps.dev",
		"https://files.pythonhosted.org",
	],
	go: ["https://proxy.golang.org"],
};

// The last two are shaped like Go module paths, the only names here that may contain slashes.
const HOSTILE_NAMES = [
	"https://evil.example/pkg",
	"//evil.example/pkg",
	"..%2f..%2fevil.example",
	"evil.example/../../../etc/passwd",
	"github.com/Evil/../../evil.example",
];

const ADAPTERS: {
	id: string;
	create: (fetcher: Fetcher) => RegistryAdapter;
}[] = [
	{ id: "npm", create: createNpmAdapter },
	{ id: "crates", create: createCratesAdapter },
	{ id: "pypi", create: createPypiAdapter },
	{ id: "go", create: createGoAdapter },
];

// Shapes every adapter can parse, so a rejection is never why a URL went unrecorded.
function answerAnything(url: string): Response {
	if (url.includes("proxy.golang.org")) return text("v1.0.0\n");
	if (url.includes("api.diffpack.io")) return json([]);
	if (url.includes("deps.dev")) {
		return json({ versions: [{ versionKey: { version: "1.0.0" } }] });
	}
	if (url.includes("crates.io")) {
		return json({ crates: [], versions: [{ num: "1.0.0" }] });
	}
	return json({ objects: [], versions: { "1.0.0": {} } });
}

for (const { id, create } of ADAPTERS) {
	const allowed = ALLOWED_ORIGINS[id] ?? [];

	describe(`${id} outbound origins`, () => {
		test("keeps every request on the registry's own origin", async () => {
			const { fetcher, calls } = stubFetch(answerAnything);
			const adapter = create(fetcher);

			for (const name of HOSTILE_NAMES) {
				// A hostile name is an ordinary miss; what matters is where the request went first.
				await adapter.search(name).catch(() => []);
				await adapter.versions(name).catch(() => []);
			}

			expect(calls.length).toBeGreaterThan(0);
			for (const { url } of calls) {
				expect(allowed).toContain(new URL(url).origin);
			}
		});

		test("keeps the download URL on the registry's own origin", () => {
			for (const name of HOSTILE_NAMES) {
				const url = adapterDownloadUrl(create, name);
				expect(allowed).toContain(new URL(url).origin);
			}
		});
	});
}

function adapterDownloadUrl(
	create: (fetcher: Fetcher) => RegistryAdapter,
	name: string,
): string {
	const { fetcher } = stubFetch(answerAnything);
	return create(fetcher).downloadUrl(name, "https://evil.example/v1.0.0");
}
