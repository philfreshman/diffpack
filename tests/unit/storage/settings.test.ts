import { describe, expect, test } from "bun:test";
import { GA_SCRIPT } from "#/lib/analytics.ts";
import * as settings from "#/lib/storage/settings.ts";
import {
	AUTOHIDE_SCROLLBAR,
	HIGHLIGHT_THEME,
	IGNORE_WHITESPACE,
	ONLY_MODIFIED,
	SHOW_SIGNS,
	SPLIT_VIEW,
	searchHistory,
	THEME_SELECTION,
	TREE_COLLAPSED,
	TREE_POSITION,
	TREE_WIDTH,
} from "#/lib/storage/settings.ts";
import {
	type HeadSetting,
	readInHead,
	readSetting,
	type StoredSetting,
	writeSetting,
} from "#/lib/storage/storedSetting.ts";
import { THEME_SCRIPT } from "#/lib/themeScript.ts";
import { TREE_WIDTH_SCRIPT } from "#/lib/tree/widthScript.ts";
import { buildDiffBootScript } from "#/lib/worker/bootScript.ts";
import { memoryStore, REFUSING_STORE } from "./storeStub.ts";

interface Case {
	setting: HeadSetting<unknown>;
	valid: Array<[string, unknown]>;
	invalid: Array<[string, unknown]>;
}

function reading<T>(
	setting: HeadSetting<T>,
	valid: Array<[string, T]>,
	invalid: Array<[string, T]>,
): Case {
	return { setting, valid, invalid };
}

const CASES: Case[] = [
	reading(
		THEME_SELECTION,
		[
			["light", "light"],
			["dark", "dark"],
			["system", "system"],
		],
		[
			["solarized", "dark"],
			["Light", "dark"],
			["", "dark"],
		],
	),
	reading(
		SPLIT_VIEW,
		[
			["true", true],
			["false", false],
		],
		[
			["yes", false],
			["TRUE", false],
			["", false],
		],
	),
	reading(
		IGNORE_WHITESPACE,
		[
			["true", true],
			["false", false],
		],
		[
			["1", false],
			["", false],
		],
	),
	reading(
		SHOW_SIGNS,
		[
			["true", true],
			["false", false],
		],
		[
			["no", true],
			["FALSE", true],
			["", true],
		],
	),
	reading(
		AUTOHIDE_SCROLLBAR,
		[
			["true", true],
			["false", false],
		],
		[
			["yes", false],
			["TRUE", false],
			["", false],
		],
	),
	reading(
		HIGHLIGHT_THEME,
		[
			["nord", "nord"],
			["base16/dracula", "base16/dracula"],
			["nightfall", "nightfall"],
		],
		[
			// "github" was the old app's default and is not offered: no choice, follow the page theme.
			["github", null],
			["solarized", null],
			["", null],
		],
	),
	reading(
		TREE_WIDTH,
		[
			["420", 420],
			["220", 220],
			["640", 640],
		],
		[
			["40", 220],
			["2000", 640],
			["-5", 220],
			// Read the way `parseInt` reads it, in the head as well.
			["300px", 300],
			[" 300", 300],
			["1e3", 220],
			["wide please", 320],
			["", 320],
		],
	),
	reading(
		TREE_COLLAPSED,
		[
			["true", true],
			["false", false],
		],
		[
			["yes", false],
			["", false],
		],
	),
	reading(
		ONLY_MODIFIED,
		[
			["false", false],
			["true", true],
		],
		[
			// The stored sense is inverted: only the literal "false" turns it off.
			["nonsense", true],
			["FALSE", true],
			["", true],
		],
	),
	reading(
		TREE_POSITION,
		[
			["left", "left"],
			["right", "right"],
		],
		[
			["Right", "left"],
			["top", "left"],
			["", "left"],
		],
	),
];

function storeHolding(key: string, raw: string | null) {
	return { getItem: (asked: string) => (asked === key ? raw : null) };
}

function storesWithNothingFor(key: string): Array<[string, unknown]> {
	return [
		["nothing is stored", storeHolding(key, null)],
		["the store throws", REFUSING_STORE],
		["there is no store at all", undefined],
	];
}

function readInHeadFrom(setting: HeadSetting<unknown>, store: unknown) {
	return new Function("localStorage", `return ${readInHead(setting)};`)(store);
}

// `useSetting` hands `readSetting` no store, so the stub stands in as the global.
function readOnceMountedFrom(setting: StoredSetting<unknown>, store: unknown) {
	const global = globalThis as { localStorage?: unknown };
	global.localStorage = store;
	try {
		return readSetting(setting);
	} finally {
		delete global.localStorage;
	}
}

for (const { setting, valid, invalid } of CASES) {
	describe(`the ${setting.key} setting`, () => {
		test.each([...valid, ...invalid])(
			"reads %p as %p in the head and once mounted",
			(raw, expected) => {
				const store = storeHolding(setting.key, raw);

				expect(readInHeadFrom(setting, store)).toEqual(expected);
				expect(readOnceMountedFrom(setting, store)).toEqual(expected);
			},
		);

		test.each(storesWithNothingFor(setting.key))(
			"reads the fallback in both when %s",
			(_, store) => {
				expect(readInHeadFrom(setting, store)).toEqual(setting.fallback);
				expect(readOnceMountedFrom(setting, store)).toEqual(setting.fallback);
			},
		);

		// The spellings are the old app's, and returning visitors already have them stored.
		test.each(valid)(
			"stores the value %p reads as in that spelling",
			(raw, value) => {
				expect(setting.serialize(value)).toBe(raw);
			},
		);
	});
}

test("has a row for every setting declared in settings.ts", () => {
	const exported: unknown[] = Object.values(settings);
	const declared = exported.filter(
		(it): it is StoredSetting<unknown> =>
			typeof it === "object" && it !== null && "key" in it,
	);

	expect(CASES.map((it) => it.setting.key).sort()).toEqual(
		declared.map((it) => it.key).sort(),
	);
});

describe("a store handed in", () => {
	test("is the one read from and written to", () => {
		const store = memoryStore();

		writeSetting(TREE_WIDTH, 420, store);

		expect(store.getItem(TREE_WIDTH.key)).toBe("420");
		expect(readSetting(TREE_WIDTH, store)).toBe(420);
	});

	test("that refuses reads as the fallback, and takes nothing down", () => {
		expect(() => writeSetting(TREE_WIDTH, 420, REFUSING_STORE)).not.toThrow();
		expect(readSetting(TREE_WIDTH, REFUSING_STORE)).toBe(TREE_WIDTH.fallback);
	});
});

// The rule pack cannot see a `localStorage` call inside a string, so a hand-written read is caught here.
const HEAD_SCRIPTS = {
	THEME_SCRIPT,
	TREE_WIDTH_SCRIPT,
	DIFF_BOOT_SCRIPT: buildDiffBootScript("/assets/diff.worker-test.js"),
	GA_SCRIPT,
};

test.each(Object.entries(HEAD_SCRIPTS))(
	"%s reads the store only through readInHead",
	(_, source) => {
		const handWritten = CASES.reduce(
			(rest, { setting }) => rest.replaceAll(readInHead(setting), ""),
			source,
		);

		expect(handWritten).not.toContain("localStorage");
	},
);

describe("the search history setting", () => {
	test("keeps the key the old app wrote, per registry", () => {
		expect(searchHistory("npm").key).toBe("search_history_npm");
		expect(searchHistory("go").key).toBe("search_history_go");
	});

	test("is the same setting for a registry every time it is asked for", () => {
		// `useSetting` reads again whenever it is handed a different setting.
		expect(searchHistory("npm")).toBe(searchHistory("npm"));
	});

	test("reads back the list it stores", () => {
		const setting = searchHistory("npm");
		const history = [{ name: "express", description: "fast" }];
		const store = storeHolding(setting.key, setting.serialize(history));

		expect(readOnceMountedFrom(setting, store)).toEqual(history);
	});

	test.each(storesWithNothingFor(searchHistory("npm").key))(
		"is empty when %s",
		(_, store) => {
			expect(readOnceMountedFrom(searchHistory("npm"), store)).toEqual([]);
		},
	);
});
