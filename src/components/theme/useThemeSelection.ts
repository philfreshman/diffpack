import { useCallback, useEffect } from "react";
import { useSetting } from "#/components/storage/useSetting.ts";
import { THEME_SELECTION } from "#/lib/storage/settings.ts";
import { applyTheme, type ThemeSelection } from "#/lib/theme.ts";

export interface ThemeSelectionControls {
	selection: ThemeSelection;
	known: boolean;
	choose(selection: ThemeSelection): void;
}

export function useThemeSelection(): ThemeSelectionControls {
	const {
		value: selection,
		known,
		set: storeSelection,
	} = useSetting(THEME_SELECTION);

	useEffect(() => {
		if (selection !== "system") return;
		const query = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = () => applyTheme(document, "system");
		query.addEventListener("change", onChange);
		return () => query.removeEventListener("change", onChange);
	}, [selection]);

	const choose = useCallback(
		(next: ThemeSelection) => {
			storeSelection(next);
			applyTheme(document, next);
		},
		[storeSelection],
	);

	return { selection, known, choose };
}
