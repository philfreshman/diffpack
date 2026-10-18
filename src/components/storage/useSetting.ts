import { useCallback, useEffect, useState } from "react";
import {
	readSetting,
	type StoredSetting,
	writeSetting,
} from "#/lib/storage/storedSetting.ts";

export interface SettingControls<T> {
	value: T;
	/** False on the server and in the first client render, while `value` is the fallback. */
	known: boolean;
	set(value: T): void;
}

/** Read after mount: reading during render would mismatch the server's fallback. */
export function useSetting<T>(setting: StoredSetting<T>): SettingControls<T> {
	// Held with its setting, so switching settings never shows the old value under the new one.
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
