/**
 * A preference kept in `localStorage` between visits. Each one is declared
 * once, in `settings.ts`, and read and written only through the functions
 * here — this is the one module that touches the store.
 *
 * What is stored is whatever an older build, another tab or a visitor with
 * devtools open left there, so `parse` takes `string | null` and always has an
 * answer: anything it cannot read is `fallback`.
 */
export interface StoredSetting<T> {
	/** What it is stored under: a contract with returning visitors. */
	readonly key: string;
	/** What a visitor with nothing stored gets, and what the server renders. */
	readonly fallback: T;
	parse(raw: string | null): T;
	serialize(value: T): string;
}

/**
 * A setting a script in `<head>` reads as well, before anything is loaded.
 * That script cannot import `parse`, so each kind of setting below carries its
 * rule a second time as JavaScript source — written beside `parse`, once per
 * kind rather than once per setting, and held to it by
 * `tests/unit/storage/settings.test.ts`.
 */
export interface HeadSetting<T> extends StoredSetting<T> {
	/** `parse`, as the source of a function expression. */
	readonly parseSource: string;
}

/**
 * On or off, stored as `"true"` or `"false"`. Only the literal opposite of
 * `fallback` moves it off its default, so anything unreadable is the default —
 * which is how the old app read these keys, whichever way round they default.
 */
export function flag({
	key,
	fallback,
}: {
	key: string;
	fallback: boolean;
}): HeadSetting<boolean> {
	const flipped = String(!fallback);

	return {
		key,
		fallback,
		parse: (raw) => (raw === flipped ? !fallback : fallback),
		parseSource: `function(raw){return raw===${JSON.stringify(flipped)}?${!fallback}:${fallback}}`,
		serialize: String,
	};
}

/** One of a fixed list of strings, stored as itself; anything else is `fallback`. */
export function oneOf<V extends string>({
	key,
	values,
	fallback,
}: {
	key: string;
	values: readonly V[];
	fallback: V;
}): HeadSetting<V> {
	const isValue = (raw: string | null): raw is V =>
		(values as readonly (string | null)[]).includes(raw);

	return {
		key,
		fallback,
		parse: (raw) => (isValue(raw) ? raw : fallback),
		parseSource: `function(raw){return ${JSON.stringify(values)}.indexOf(raw)<0?${JSON.stringify(fallback)}:raw}`,
		serialize: String,
	};
}

/**
 * A whole number, stored in decimal. One out of bounds is brought within them;
 * one that is not a number at all is `fallback`.
 */
export function clampedInteger({
	key,
	min,
	max,
	fallback,
}: {
	key: string;
	min: number;
	max: number;
	fallback: number;
}): HeadSetting<number> & { readonly min: number; readonly max: number } {
	return {
		key,
		min,
		max,
		fallback,
		parse(raw) {
			const parsed = raw === null ? Number.NaN : Number.parseInt(raw, 10);
			if (Number.isNaN(parsed)) return fallback;

			return Math.min(max, Math.max(min, parsed));
		},
		parseSource: `function(raw){var n=parseInt(raw,10);return isNaN(n)?${fallback}:Math.min(${max},Math.max(${min},n))}`,
		serialize: String,
	};
}

/**
 * The store is absent on the server, and a browser in private mode or with
 * site data blocked can throw on any use of it. Neither is a reason to fail a
 * render: a setting that cannot be read is its fallback, and one that cannot
 * be written still holds for the session wherever it was set.
 */
function readStored(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

export function readSetting<T>(setting: StoredSetting<T>): T {
	return setting.parse(readStored(setting.key));
}

export function writeSetting<T>(setting: StoredSetting<T>, value: T): void {
	try {
		localStorage.setItem(setting.key, setting.serialize(value));
	} catch {
		// Not persisted; the page still does what was asked for this session.
	}
}

/**
 * `readSetting`, as a JavaScript expression for a script in `<head>`, where
 * nothing can be imported. Guarded the same way, so a store that throws reads
 * as the fallback there too rather than taking the rest of the script with it.
 */
export function readInHead(setting: HeadSetting<unknown>): string {
	return `(${setting.parseSource})(function(){try{return localStorage.getItem(${JSON.stringify(setting.key)})}catch(e){return null}}())`;
}
