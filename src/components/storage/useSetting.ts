import { useCallback, useEffect, useState } from "react";
import {
	readSetting,
	type StoredSetting,
	writeSetting,
} from "#/lib/storage/storedSetting.ts";

export interface SettingControls<T> {
	/** The stored value once it has been read, and the fallback until then. */
	value: T;
	/**
	 * Whether `value` has been read yet. It has not on the server or in the
	 * first client render, which must agree — so a caller that must not act on
	 * the fallback as if it were the answer waits for this.
	 */
	known: boolean;
	/** Changes the value here, and stores it for the next visit. */
	set(value: T): void;
}

/**
 * A stored setting as component state. It cannot be read during render — the
 * server has no `localStorage`, and reading it in the first client render is
 * the same mismatch — so every caller starts on the fallback, which is what
 * the server rendered, and the stored value arrives once mounted.
 */
export function useSetting<T>(setting: StoredSetting<T>): SettingControls<T> {
	// Held with the setting it was read for, so a caller that moves to another
	// setting — search history is one per registry — never shows the old one's
	// value under the new one's name while the new one is read.
	const [held, setHeld] = useState<{
		setting: StoredSetting<T>;
		value: T;
	} | null>(null);

	useEffect(() => setHeld({ setting, value: readSetting(setting) }), [setting]);

	const set = useCallback(
		(value: T) => {
			setHeld({ setting, value });
			writeSetting(setting, value);
		},
		[setting],
	);

	const current = held?.setting === setting ? held : null;

	return {
		value: current ? current.value : setting.fallback,
		known: current !== null,
		set,
	};
}
