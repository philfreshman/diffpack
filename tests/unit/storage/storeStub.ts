import type { SettingStore } from "#/lib/storage/storedSetting.ts";

/** A store that keeps what it is given for the length of a test. */
export function memoryStore(): SettingStore {
	const held = new Map<string, string>();

	return {
		getItem: (key) => held.get(key) ?? null,
		setItem(key, value) {
			held.set(key, value);
		},
	};
}

/** Private mode, or site data blocked: the store is there but refuses. */
export const REFUSING_STORE: SettingStore = {
	getItem(): never {
		throw new Error("SecurityError");
	},
	setItem(): never {
		throw new Error("SecurityError");
	},
};
