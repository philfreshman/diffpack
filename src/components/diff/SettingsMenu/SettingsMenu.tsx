import { NavigationMenu } from "@base-ui/react/navigation-menu";
import { ThemeSwitch } from "#/components/theme/ThemeSwitch/ThemeSwitch.tsx";
import { useThemeSelection } from "#/components/theme/useThemeSelection.ts";
import type { HighlightThemeControls } from "#/components/diff/useHighlightTheme.ts";
import iconButtonStyles from "#/components/ui/IconButton/IconButton.module.css";
import {
	CheckIcon,
	ChevronRightIcon,
	SettingsIcon,
} from "#/components/ui/icons.tsx";
import { HIGHLIGHT_THEMES } from "#/lib/diff/highlightThemes.ts";
import styles from "./SettingsMenu.module.css";

export interface SettingsMenuProps {
	ignoreWhitespace: boolean;
	onIgnoreWhitespaceChange(ignore: boolean): void;
	showSigns: boolean;
	onShowSignsChange(show: boolean): void;
	/** Passed in, not called here: the viewer must read the same hook instance. */
	highlight: HighlightThemeControls;
}
export function SettingsMenu({
	ignoreWhitespace,
	onIgnoreWhitespaceChange,
	showSigns,
	onShowSignsChange,
	highlight,
}: SettingsMenuProps) {
	// Called here, not in the menu's content: the content unmounts when the menu shuts,
	// and the system selection must keep following the operating system.
	const themeSelection = useThemeSelection();

	return (
		<NavigationMenu.Root className={styles.root} orientation="vertical">
			<NavigationMenu.List className={styles.list}>
				<NavigationMenu.Item>
					<NavigationMenu.Trigger
						className={`${iconButtonStyles.iconButton} ${styles.gear}`}
						aria-label="Settings"
						title="Settings"
					>
						<SettingsIcon width="16" height="16" />
					</NavigationMenu.Trigger>

					<NavigationMenu.Content className={styles.content}>
						<ul className={styles.options}>
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

							<li>
								<NavigationMenu.Root orientation="vertical">
									<NavigationMenu.List className={styles.options}>
										<NavigationMenu.Item>
											<NavigationMenu.Trigger
												className={styles.option}
												data-testid="theme-fold"
											>
												Theme
												<span className={styles.value}>
													{label(highlight.theme)}
												</span>
												<NavigationMenu.Icon className={styles.fold}>
													<ChevronRightIcon width="14" height="14" />
												</NavigationMenu.Icon>
											</NavigationMenu.Trigger>

											<NavigationMenu.Content className={styles.content}>
												<ul className={styles.options}>
													{HIGHLIGHT_THEMES.map((theme) => (
														<li key={theme.value}>
															<button
																className={styles.option}
																data-testid="theme-option"
																data-theme={theme.value}
																aria-pressed={highlight.theme === theme.value}
																onClick={() => highlight.choose(theme.value)}
																type="button"
															>
																{theme.label}
																{highlight.theme === theme.value && (
																	<CheckIcon
																		className={styles.chosen}
																		width="14"
																		height="14"
																	/>
																)}
															</button>
														</li>
													))}
												</ul>
											</NavigationMenu.Content>
										</NavigationMenu.Item>
									</NavigationMenu.List>

									<NavigationMenu.Portal>
										<NavigationMenu.Positioner
											className={styles.positioner}
											sideOffset={8}
											alignOffset={-8}
											align="start"
											side="left"
										>
											<NavigationMenu.Popup
												className={styles.popup}
												data-testid="theme-popup"
											>
												<NavigationMenu.Viewport className={styles.viewport} />
											</NavigationMenu.Popup>
										</NavigationMenu.Positioner>
									</NavigationMenu.Portal>
								</NavigationMenu.Root>
							</li>

							<li className={styles.switchRow}>
								<ThemeSwitch {...themeSelection} />
							</li>
						</ul>
					</NavigationMenu.Content>
				</NavigationMenu.Item>
			</NavigationMenu.List>

			<NavigationMenu.Portal>
				<NavigationMenu.Positioner
					className={styles.positioner}
					sideOffset={6}
					align="end"
				>
					<NavigationMenu.Popup className={styles.popup}>
						<NavigationMenu.Viewport className={styles.viewport} />
					</NavigationMenu.Popup>
				</NavigationMenu.Positioner>
			</NavigationMenu.Portal>
		</NavigationMenu.Root>
	);
}

function ToggleOption({
	label,
	on,
	onChange,
}: {
	label: string;
	on: boolean;
	onChange(on: boolean): void;
}) {
	return (
		<li>
			<button
				className={styles.option}
				aria-pressed={on}
				onClick={() => onChange(!on)}
				type="button"
			>
				{label}
				{on && <CheckIcon className={styles.chosen} width="14" height="14" />}
			</button>
		</li>
	);
}

function label(theme: string | null): string {
	return HIGHLIGHT_THEMES.find((it) => it.value === theme)?.label ?? "";
}
