import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { IconButton } from "#/components/ui/IconButton/IconButton.tsx";
import { MoonIcon, SunIcon, SystemIcon } from "#/components/ui/icons.tsx";
import {
	applyTheme,
	DEFAULT_SELECTION,
	nextSelection,
	readSelection,
	type ThemeSelection,
	writeSelection,
} from "#/lib/theme.ts";
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
	// Renders the default first and corrects on mount: the real selection lives
	// in localStorage, which the server cannot see. Until then the button is
	// disabled — pre-hydration it would show a possibly-wrong icon and swallow
	// the click.
	const [selection, setSelection] = useState<ThemeSelection>(DEFAULT_SELECTION);
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setSelection(readSelection());
		setMounted(true);
	}, []);

	useEffect(() => {
		// Only "system" tracks the OS, and only until the visitor picks a theme.
		if (selection !== "system") return;
		const query = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = () => applyTheme(document, "system");
		query.addEventListener("change", onChange);
		return () => query.removeEventListener("change", onChange);
	}, [selection]);

	const handleClick = useCallback(() => {
		const next = nextSelection(readSelection());
		writeSelection(next);
		applyTheme(document, next);
		setSelection(next);
	}, []);

	return (
		<IconButton
			className={floating ? styles.floating : undefined}
			aria-label={LABELS[selection]}
			disabled={!mounted}
			onClick={handleClick}
		>
			{ICONS[selection]}
		</IconButton>
	);
}
