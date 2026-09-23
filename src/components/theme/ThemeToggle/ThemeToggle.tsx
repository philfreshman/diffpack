import type { ReactNode } from "react";
import { useCallback, useEffect } from "react";
import { useSetting } from "#/components/storage/useSetting.ts";
import { IconButton } from "#/components/ui/IconButton/IconButton.tsx";
import { MoonIcon, SunIcon, SystemIcon } from "#/components/ui/icons.tsx";
import { THEME_SELECTION } from "#/lib/storage/settings.ts";
import { applyTheme, nextSelection, type ThemeSelection } from "#/lib/theme.ts";
import styles from "./ThemeToggle.module.css";

const ICONS: Record<ThemeSelection, ReactNode> = {
	light: <SunIcon />,
	dark: <MoonIcon />,
	system: <SystemIcon />,
};

const LABELS: Record<ThemeSelection, string> = {
	light: "Switch to dark theme",
	dark: "Switch to system theme",
	system: "Switch to light theme",
};

/**
 * `floating` pins it to the top corner of a page with no chrome of its own to
 * hold it — the landing page and the 404. The workspace keeps it in the
 * sidebar's footing instead.
 */
export function ThemeToggle({ floating = false }: { floating?: boolean }) {
	// Renders the default first and corrects on mount: the real selection is
	// stored, and the server cannot see it. Until then the button is disabled —
	// pre-hydration it would show a possibly-wrong icon and swallow the click.
	const {
		value: selection,
		known,
		set: storeSelection,
	} = useSetting(THEME_SELECTION);

	useEffect(() => {
		// Only "system" tracks the OS, and only until the visitor picks a theme.
		if (selection !== "system") return;
		const query = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = () => applyTheme(document, "system");
		query.addEventListener("change", onChange);
		return () => query.removeEventListener("change", onChange);
	}, [selection]);

	const handleClick = useCallback(() => {
		const next = nextSelection(selection);
		storeSelection(next);
		applyTheme(document, next);
	}, [selection, storeSelection]);

	return (
		<IconButton
			className={
				floating ? `${styles.toggle} ${styles.floating}` : styles.toggle
			}
			aria-label={LABELS[selection]}
			disabled={!known}
			onClick={handleClick}
		>
			{ICONS[selection]}
		</IconButton>
	);
}
