import { ThemeSwitch } from "#/components/theme/ThemeSwitch/ThemeSwitch.tsx";
import { useThemeSelection } from "#/components/theme/useThemeSelection.ts";
import type { HighlightThemeControls } from "#/components/diff/useHighlightTheme.ts";
import { SettingsIcon } from "#/components/ui/icons.tsx";
import {
	ChoiceOption,
	FoldOutOption,
	OptionsMenu,
	ToggleOption,
} from "#/components/ui/OptionsMenu/OptionsMenu.tsx";
import { HIGHLIGHT_THEMES } from "#/lib/diff/highlightThemes.ts";
import styles from "./SettingsMenu.module.css";

export interface SettingsMenuProps {
	ignoreWhitespace: boolean;
	onIgnoreWhitespaceChange(ignore: boolean): void;
	showSigns: boolean;
	onShowSignsChange(show: boolean): void;
	autohideScrollbar: boolean;
	onAutohideScrollbarChange(autohide: boolean): void;
	/** Passed in, not called here: the viewer must read the same hook instance. */
	highlight: HighlightThemeControls;
}
export function SettingsMenu({
	ignoreWhitespace,
	onIgnoreWhitespaceChange,
	showSigns,
	onShowSignsChange,
	autohideScrollbar,
	onAutohideScrollbarChange,
	highlight,
}: SettingsMenuProps) {
	// Called here, not in the menu's content: the content unmounts when the menu shuts,
	// and the system selection must keep following the operating system.
	const themeSelection = useThemeSelection();

	return (
		<OptionsMenu
			label="Settings"
			icon={<SettingsIcon width="16" height="16" />}
		>
			<ToggleOption
				label="Ignore whitespaces"
				on={ignoreWhitespace}
				onChange={onIgnoreWhitespaceChange}
			/>
			<ToggleOption
				label="Show +/- signs"
				on={showSigns}
				onChange={onShowSignsChange}
			/>
			<ToggleOption
				label="Auto-hide scrollbar"
				on={autohideScrollbar}
				onChange={onAutohideScrollbarChange}
			/>

			<FoldOutOption
				label="Theme"
				value={label(highlight.theme)}
				side="left"
				testId="theme"
			>
				{HIGHLIGHT_THEMES.map((theme) => (
					<ChoiceOption
						key={theme.value}
						label={theme.label}
						chosen={highlight.theme === theme.value}
						onChoose={() => highlight.choose(theme.value)}
						data-testid="theme-option"
						data-theme={theme.value}
					/>
				))}
			</FoldOutOption>

			<li className={styles.switchRow}>
				<ThemeSwitch {...themeSelection} />
			</li>
		</OptionsMenu>
	);
}

function label(theme: string | null): string {
	return HIGHLIGHT_THEMES.find((it) => it.value === theme)?.label ?? "";
}
