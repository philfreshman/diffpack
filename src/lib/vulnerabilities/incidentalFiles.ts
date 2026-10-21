const PATH_SEPARATOR = "/";

const MANIFEST_NAMES = new Set([
	"package.json",
	"package-lock.json",
	"npm-shrinkwrap.json",
	"yarn.lock",
	"pnpm-lock.yaml",
	"bun.lock",
	"bun.lockb",
	"Cargo.toml",
	"Cargo.lock",
	"go.mod",
	"go.sum",
	"composer.json",
	"composer.lock",
	"pyproject.toml",
	"setup.py",
	"setup.cfg",
	"Pipfile",
	"Pipfile.lock",
	"poetry.lock",
]);

const REQUIREMENTS_NAME = /^requirements.*\.txt$/i;
const DOCUMENT_NAME = /\.(?:md|rst|txt)$/i;
const RELEASE_NOTES_NAME = /^(?:CHANGELOG|HISTORY|NEWS)/i;
const TEST_FILE_NAME = /\.(?:test|spec)\.|_test\.go$/i;
const TEST_DIRECTORIES = new Set(["test", "tests", "__tests__", "spec"]);

function isManifest(name: string): boolean {
	return MANIFEST_NAMES.has(name) || REQUIREMENTS_NAME.test(name);
}

function isDocumentation(name: string): boolean {
	return DOCUMENT_NAME.test(name) || RELEASE_NOTES_NAME.test(name);
}

function isTest(directories: string[], name: string): boolean {
	return (
		TEST_FILE_NAME.test(name) ||
		directories.some((directory) =>
			TEST_DIRECTORIES.has(directory.toLowerCase()),
		)
	);
}

export function isIncidentalFile(path: string): boolean {
	const segments = path.split(PATH_SEPARATOR);
	const name = segments.pop() ?? "";
	return isManifest(name) || isDocumentation(name) || isTest(segments, name);
}
