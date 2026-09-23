import { describe, expect, test } from "bun:test";
import {
	HIGHLIGHT_THEME,
	IGNORE_WHITESPACE,
	ONLY_MODIFIED,
	SPLIT_VIEW,
	THEME_SELECTION,
	TREE_COLLAPSED,
	TREE_WIDTH,
} from "#/lib/storage/settings.ts";
import {
	type HeadSetting,
	readInHead,
	readSetting,
} from "#/lib/storage/storedSetting.ts";

interface Case {
	setting: HeadSetting<unknown>;
	/** Stored spellings the app writes itself, and the value each one is. */
	valid: Array<[string, unknown]>;
	/** Anything else that can end up under the key, and what it reads as. */
	invalid: Array<[string, unknown]>;
}

/** Keeps each case's expected values the setting's own type. */
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
			// diffpack is dark for anyone who has not chosen otherwise.
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
		HIGHLIGHT_THEME,
		[
			["nord", "nord"],
			["base16/dracula", "base16/dracula"],
			["nightfall", "nightfall"],
		],
		[
			// No longer offered — `"github"` was the old app's light default,
			// and never one of its own options — so no choice at all, which
			// follows the page theme.
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
			// Brought within bounds: the panel has to stay readable and leave
			// the diff room, whatever build or screen stored the width.
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
];

/** A store holding `raw` under `key`, and nothing under any other. */
function storeHolding(key: string, raw: string | null) {
	return { getItem: (asked: string) => (asked === key ? raw : null) };
}

/** Private mode, or site data blocked: the store is there but refuses. */
const REFUSING_STORE = {
	getItem(): never {
		throw new Error("SecurityError");
	},
};

/**
 * The head script ships as a string, so the only honest way to test its read
 * is to run it — against a stubbed store, the way `bootScript.test.ts` runs
 * the diff boot.
 */
function readInHeadFrom(setting: HeadSetting<unknown>, store: unknown) {
	return new Function("localStorage", `return ${readInHead(setting)};`)(store);
}

/**
 * What `useSetting` reads once mounted. It takes no store as a parameter, so
 * the stub stands in as the global for the length of the read.
 */
function readOnceMountedFrom(setting: HeadSetting<unknown>, store: unknown) {
	const global = globalThis as { localStorage?: unknown };
	global.localStorage = store;
	try {
		return readSetting(setting);
	} finally {
		delete global.localStorage;
	}
}

/**
 * The pre-paint scripts and the components read the same stored values before
 * and after hydration. If they disagree, the page paints one answer and then
 * flips to the other — or, for the diff boot, builds a tree the session then
 * throws away.
 */
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

		test.each([
			["nothing is stored", storeHolding(setting.key, null)],
			["the store throws", REFUSING_STORE],
			["there is no store at all", undefined],
		])("reads the fallback in both when %s", (_, store) => {
			expect(readInHeadFrom(setting, store)).toEqual(setting.fallback);
			expect(readOnceMountedFrom(setting, store)).toEqual(setting.fallback);
		});

		// What is written has to read back as itself: the spellings are the
		// old app's, and returning visitors already have them stored.
		test.each(valid)(
			"stores the value %p reads as in that spelling",
			(raw, value) => {
				expect(setting.serialize(value)).toBe(raw);
			},
		);
	});
}
