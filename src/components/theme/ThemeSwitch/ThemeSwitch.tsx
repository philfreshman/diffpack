import type { ReactNode } from "react";
import type { ThemeSelectionControls } from "#/components/theme/useThemeSelection.ts";
import { MoonIcon, SunIcon, SystemIcon } from "#/components/ui/icons.tsx";
import { SELECTIONS, type ThemeSelection } from "#/lib/theme.ts";
import styles from "./ThemeSwitch.module.css";

const ICONS: Record<ThemeSelection, ReactNode> = {
	light: <SunIcon width="14" height="14" />,
	dark: <MoonIcon width="14" height="14" />,
	system: <SystemIcon width="14" height="14" />,
};

const LABELS: Record<ThemeSelection, string> = {
	light: "Light",
	dark: "Dark",
	system: "System",
};

export function ThemeSwitch({
	selection,
	known,
	choose,
}: ThemeSelectionControls) {
	return (
		<div className={styles.switch} data-testid="theme-switch">
			{SELECTIONS.map((option) => (
				<button
					key={option}
					className={styles.segment}
					aria-pressed={known && selection === option}
					aria-label={LABELS[option]}
					title={LABELS[option]}
					disabled={!known}
					onClick={() => choose(option)}
					type="button"
				>
					{ICONS[option]}
				</button>
			))}
		</div>
	);
}
