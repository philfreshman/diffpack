// A stored value may come from an older build or devtools: `parse` must always
// answer, with `fallback` for anything unreadable.
export interface StoredSetting<T> {
	/** A contract with returning visitors: never rename. */
	readonly key: string;
	/** Also what the server renders. */
	readonly fallback: T;
	parse(raw: string | null): T;
	serialize(value: T): string;
}

// `parseSource` restates `parse` for `<head>` scripts, which cannot import it.
// `tests/unit/storage/settings.test.ts` keeps the two in step.
export interface HeadSetting<T> extends StoredSetting<T> {
	readonly parseSource: string;
}

// Only the literal opposite of `fallback` moves it off its default, as these
// keys have always been read.
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

// `fallback` may be `null`, for a default the reader works out itself.
export function oneOf<V extends string, F extends V | null>({
	key,
	values,
	fallback,
}: {
	key: string;
	values: readonly V[];
	fallback: F;
}): HeadSetting<V | F> {
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
}): HeadSetting<number> & {
	readonly min: number;
	readonly max: number;
	clamp(value: number): number;
} {
	const clamp = (value: number) => Math.min(max, Math.max(min, value));

	return {
		key,
		min,
		max,
		fallback,
		clamp,
		parse(raw) {
			const parsed = raw === null ? Number.NaN : Number.parseInt(raw, 10);
			if (Number.isNaN(parsed)) return fallback;

			return clamp(parsed);
		},
		parseSource: `function(raw){var n=parseInt(raw,10);return isNaN(n)?${fallback}:Math.min(${max},Math.max(${min},n))}`,
		serialize: String,
	};
}

export type SettingStore = Pick<Storage, "getItem" | "setItem">;

// Absent on the server, and it can throw in private mode or with site data
// blocked. An unreadable setting is its fallback.
function readStored(key: string, store?: SettingStore): string | null {
	try {
		return (store ?? localStorage).getItem(key);
	} catch {
		return null;
	}
}

export function readSetting<T>(
	setting: StoredSetting<T>,
	store?: SettingStore,
): T {
	return setting.parse(readStored(setting.key, store));
}

export function writeSetting<T>(
	setting: StoredSetting<T>,
	value: T,
	store?: SettingStore,
): void {
	try {
		(store ?? localStorage).setItem(setting.key, setting.serialize(value));
	} catch {
		// Not persisted; it still applies for this session.
	}
}

// Guarded like `readStored`, so a throwing store cannot break the head script.
export function readInHead(setting: HeadSetting<unknown>): string {
	return `(${setting.parseSource})(function(){try{return localStorage.getItem(${JSON.stringify(setting.key)})}catch(e){return null}}())`;
}
