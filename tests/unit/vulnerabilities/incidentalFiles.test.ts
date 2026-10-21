import { describe, expect, test } from "bun:test";
import { isIncidentalFile } from "#/lib/vulnerabilities/incidentalFiles.ts";

describe("isIncidentalFile", () => {
	test.each([
		"package.json",
		"packages/express/package.json",
		"package-lock.json",
		"yarn.lock",
		"pnpm-lock.yaml",
		"Cargo.toml",
		"Cargo.lock",
		"go.mod",
		"go.sum",
		"composer.json",
		"composer.lock",
		"pyproject.toml",
		"setup.py",
		"setup.cfg",
		"requirements.txt",
		"requirements-dev.txt",
		"README.md",
		"docs/index.rst",
		"LICENSE.txt",
		"CHANGELOG",
		"History.md",
		"NEWS",
		"test/router.js",
		"tests/test_render.py",
		"src/__tests__/trim.js",
		"spec/parser_spec.rb",
		"lib/trim.test.js",
		"lib/trim.spec.ts",
		"html/render_test.go",
	])("counts %s as incidental", (path) => {
		expect(isIncidentalFile(path)).toBe(true);
	});

	test.each([
		"lib/router.js",
		"html/render.go",
		"src/sync/oneshot.rs",
		"jinja2/sandbox.py",
		"src/Testing.php",
		"lib/latest.js",
		"contest/index.js",
	])("counts %s as source", (path) => {
		expect(isIncidentalFile(path)).toBe(false);
	});
});
