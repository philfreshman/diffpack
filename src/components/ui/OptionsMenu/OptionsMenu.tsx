import { NavigationMenu } from "@base-ui/react/navigation-menu";
import {
	type ComponentProps,
	createContext,
	type ReactNode,
	use,
	useRef,
	useState,
} from "react";
import iconButtonStyles from "#/components/ui/IconButton/IconButton.module.css";
import {
	CheckIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
} from "#/components/ui/icons.tsx";
import styles from "./OptionsMenu.module.css";

export type FoldOutSide = "left" | "right";

const FOLD_OUT_CHEVRONS: Record<FoldOutSide, typeof ChevronRightIcon> = {
	left: ChevronLeftIcon,
	right: ChevronRightIcon,
};

const OPTIONS_ITEM = "options";

type CloseMenuThen = (then: () => void) => void;

const CloseMenuThenContext = createContext<CloseMenuThen>((then) => then());

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
	const { openItem, setOpenItem, closeMenuThen, runAfterClose } =
		useCloseMenuThen();

	return (
		<NavigationMenu.Root
			className={styles.root}
			orientation="vertical"
			value={openItem}
			onValueChange={setOpenItem}
			onOpenChangeComplete={runAfterClose}
		>
			<NavigationMenu.List className={styles.list}>
				<NavigationMenu.Item value={OPTIONS_ITEM}>
					<NavigationMenu.Trigger
						className={`${iconButtonStyles.iconButton} ${styles.trigger} ${triggerClassName}`}
						aria-label={label}
						title={label}
					>
						{icon}
					</NavigationMenu.Trigger>

					<NavigationMenu.Content className={styles.content}>
						<CloseMenuThenContext value={closeMenuThen}>
							<ul className={styles.options}>{children}</ul>
						</CloseMenuThenContext>
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

function useCloseMenuThen() {
	const [openItem, setOpenItem] = useState<string | null>(null);
	const afterCloseRef = useRef<(() => void) | null>(null);

	function closeMenuThen(then: () => void) {
		afterCloseRef.current = then;
		setOpenItem(null);
	}

	function runAfterClose(open: boolean) {
		if (open) return;
		const then = afterCloseRef.current;
		afterCloseRef.current = null;
		then?.();
	}

	return { openItem, setOpenItem, closeMenuThen, runAfterClose };
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
	closesMenu = false,
	...buttonProps
}: {
	label: string;
	chosen: boolean;
	onChoose(): void;
	closesMenu?: boolean;
} & Omit<ComponentProps<"button">, "className" | "onClick" | "type">) {
	const closeMenuThen = use(CloseMenuThenContext);

	return (
		<li>
			<button
				{...buttonProps}
				className={styles.option}
				aria-pressed={chosen}
				onClick={closesMenu ? () => closeMenuThen(onChoose) : onChoose}
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
