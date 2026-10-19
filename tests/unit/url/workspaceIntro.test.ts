import { describe, expect, test } from "bun:test";
import { cratesAdapter } from "#/lib/registries/crates.ts";
import { npmAdapter } from "#/lib/registries/npm.ts";
import { workspaceIntro } from "#/lib/url/workspaceIntro.ts";

const NO_SELECTION = { package: "", from: "", to: "", file: "" };

describe("workspaceIntro", () => {
	test("introduces the registry when no package is chosen", () => {
		expect(
			workspaceIntro(cratesAdapter, { ...NO_SELECTION, registry: "crates" }),
		).toBe(
			"Compare two versions of any crates.io package. Search for a package, pick two versions, and see every file that was added, removed, renamed or changed.",
		);
	});

	test("keeps introducing the registry until both versions are chosen", () => {
		expect(
			workspaceIntro(npmAdapter, {
				...NO_SELECTION,
				registry: "npm",
				package: "react",
				from: "18.0.0",
			}),
		).toBe(workspaceIntro(npmAdapter, { ...NO_SELECTION, registry: "npm" }));
	});

	test("summarizes the comparison named in the URL", () => {
		expect(
			workspaceIntro(npmAdapter, {
				registry: "npm",
				package: "react",
				from: "18.0.0",
				to: "19.0.0",
				file: "",
			}),
		).toBe(
			"Every file that changed between react 18.0.0 and 19.0.0: added, removed, renamed or edited files, with a diff for each.",
		);
	});

	test("summarizes the comparison, not the file, on a file URL", () => {
		expect(
			workspaceIntro(npmAdapter, {
				registry: "npm",
				package: "@types/node",
				from: "26.6.0",
				to: "26.7.0",
				file: "package.json",
			}),
		).toBe(
			"Every file that changed between @types/node 26.6.0 and 26.7.0: added, removed, renamed or edited files, with a diff for each.",
		);
	});
});
