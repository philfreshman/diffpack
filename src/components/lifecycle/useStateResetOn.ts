import { type Dispatch, type SetStateAction, useState } from "react";

export function useStateResetOn<T>(
	initial: () => T,
	resetKeys: readonly unknown[],
): [T, Dispatch<SetStateAction<T>>] {
	const [state, setState] = useState(initial);
	const [seenKeys, setSeenKeys] = useState(resetKeys);

	if (!sameKeys(seenKeys, resetKeys)) {
		setSeenKeys(resetKeys);
		setState(initial());
	}

	return [state, setState];
}

function sameKeys(
	seen: readonly unknown[],
	current: readonly unknown[],
): boolean {
	return (
		seen.length === current.length &&
		seen.every((key, index) => Object.is(key, current[index]))
	);
}
