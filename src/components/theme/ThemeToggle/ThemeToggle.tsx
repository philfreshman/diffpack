import type { ReactNode } from "react";
import { useThemeSelection } from "#/components/theme/useThemeSelection.ts";
import { IconButton } from "#/components/ui/IconButton/IconButton.tsx";
import { MoonIcon, SunIcon, SystemIcon } from "#/components/ui/icons.tsx";
import { nextSelection, type ThemeSelection } from "#/lib/theme.ts";
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

export function ThemeToggle() {
	// Disabled until known: before then it shows a guessed icon and would swallow the click.
	const { selection, known, choose } = useThemeSelection();

	return (
		<IconButton
			className={`${styles.toggle} ${styles.floating}`}
			aria-label={LABELS[selection]}
			disabled={!known}
			onClick={() => choose(nextSelection(selection))}
		>
			{ICONS[selection]}
		</IconButton>
	);
}
