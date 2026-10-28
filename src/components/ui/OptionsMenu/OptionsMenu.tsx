import { NavigationMenu } from "@base-ui/react/navigation-menu";
import type { ComponentProps, ReactNode } from "react";
import iconButtonStyles from "#/components/ui/IconButton/IconButton.module.css";
import {
	CheckIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
} from "#/components/ui/icons.tsx";
import styles from "./OptionsMenu.module.css";

type FoldOutSide = "left" | "right";

const FOLD_OUT_CHEVRONS: Record<FoldOutSide, typeof ChevronRightIcon> = {
	left: ChevronLeftIcon,
	right: ChevronRightIcon,
};

export interface OptionsMenuProps {
	label: string;
	icon: ReactNode;
	triggerClassName?: string;
	children: ReactNode;
}
export function OptionsMenu({
	label,
	icon,
	triggerClassName = "",
	children,
}: OptionsMenuProps) {
	return (
		<NavigationMenu.Root className={styles.root} orientation="vertical">
			<NavigationMenu.List className={styles.list}>
				<NavigationMenu.Item>
					<NavigationMenu.Trigger
						className={`${iconButtonStyles.iconButton} ${styles.trigger} ${triggerClassName}`}
						aria-label={label}
						title={label}
					>
						{icon}
					</NavigationMenu.Trigger>

					<NavigationMenu.Content className={styles.content}>
						<ul className={styles.options}>{children}</ul>
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

export function ToggleOption({
	label,
	on,
	onChange,
}: {
	label: string;
	on: boolean;
	onChange(on: boolean): void;
}) {
	return (
		<ChoiceOption label={label} chosen={on} onChoose={() => onChange(!on)} />
	);
}

export function ChoiceOption({
	label,
	chosen,
	onChoose,
	...buttonProps
}: {
	label: string;
	chosen: boolean;
	onChoose(): void;
} & Omit<ComponentProps<"button">, "className" | "onClick" | "type">) {
	return (
		<li>
			<button
				{...buttonProps}
				className={styles.option}
				aria-pressed={chosen}
				onClick={onChoose}
				type="button"
			>
				{label}
				{chosen && (
					<CheckIcon className={styles.chosen} width="14" height="14" />
				)}
			</button>
		</li>
	);
}

export function FoldOutOption({
	label,
	value,
	side,
	testId,
	children,
}: {
	label: string;
	value: string;
	side: FoldOutSide;
	testId: string;
	children: ReactNode;
}) {
	const Chevron = FOLD_OUT_CHEVRONS[side];

	return (
		<li>
			<NavigationMenu.Root orientation="vertical">
				<NavigationMenu.List className={styles.options}>
					<NavigationMenu.Item>
						<NavigationMenu.Trigger
							className={styles.option}
							data-testid={`${testId}-fold`}
						>
							{label}
							<span className={styles.value}>{value}</span>
							<NavigationMenu.Icon className={styles.fold}>
								<Chevron width="14" height="14" />
							</NavigationMenu.Icon>
						</NavigationMenu.Trigger>

						<NavigationMenu.Content className={styles.content}>
							<ul className={styles.options}>{children}</ul>
						</NavigationMenu.Content>
					</NavigationMenu.Item>
				</NavigationMenu.List>

				<NavigationMenu.Portal>
					<NavigationMenu.Positioner
						className={styles.positioner}
						sideOffset={8}
						alignOffset={-8}
						align="start"
						side={side}
					>
						<NavigationMenu.Popup
							className={styles.popup}
							data-testid={`${testId}-popup`}
						>
							<NavigationMenu.Viewport className={styles.viewport} />
						</NavigationMenu.Popup>
					</NavigationMenu.Positioner>
				</NavigationMenu.Portal>
			</NavigationMenu.Root>
		</li>
	);
}
