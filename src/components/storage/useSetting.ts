import { useCallback, useState } from "react";
import { useHydrated } from "#/components/lifecycle/useHydrated.ts";
import {
	readSetting,
	type StoredSetting,
	writeSetting,
} from "#/lib/storage/storedSetting.ts";

export interface SettingControls<T> {
	value: T;
	/** False on the server and while hydrating, while `value` is the fallback. */
	known: boolean;
	set(value: T): void;
}

/** Read after hydration: reading during it would mismatch the server's fallback. */
export function useSetting<T>(setting: StoredSetting<T>): SettingControls<T> {
	const hydrated = useHydrated();
	// Held with its setting, so switching settings never shows the old value under the new one.
	const [held, setHeld] = useState<{
		setting: StoredSetting<T>;
		value: T;
	} | null>(null);

	const set = useCallback(
		(value: T) => {
			setHeld({ setting, value });
			writeSetting(setting, value);
		},
		[setting],
	);

	if (held?.setting === setting) {
		return { value: held.value, known: true, set };
	}

	return {
		value: hydrated ? readSetting(setting) : setting.fallback,
		known: hydrated,
		set,
	};
}
