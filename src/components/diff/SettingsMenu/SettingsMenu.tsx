import { NavigationMenu } from "@base-ui/react/navigation-menu";
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
	/** Passed in, not called here: the viewer must read the same hook instance. */
	highlight: HighlightThemeControls;
}
export function SettingsMenu({
	ignoreWhitespace,
	onIgnoreWhitespaceChange,
	highlight,
}: SettingsMenuProps) {
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
							<li>
								<button
									className={styles.option}
									aria-pressed={ignoreWhitespace}
									onClick={() => onIgnoreWhitespaceChange(!ignoreWhitespace)}
									type="button"
								>
									Ignore whitespaces
									{ignoreWhitespace && (
										<CheckIcon
											className={styles.chosen}
											width="14"
											height="14"
										/>
									)}
								</button>
							</li>

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

function label(theme: string | null): string {
	return HIGHLIGHT_THEMES.find((it) => it.value === theme)?.label ?? "";
}
