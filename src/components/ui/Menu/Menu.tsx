import { Menu as Base } from "@base-ui/react/menu";
import type { ReactElement, ReactNode } from "react";
import styles from "./Menu.module.css";

export interface MenuProps {
	/** Accessible name for the trigger, which may show only a label and an icon. */
	label: string;
	/** What the trigger shows. */
	trigger: ReactNode;
	/** Placement of the trigger in its container; the look is the caller's. */
	triggerClassName?: string;
	children: ReactNode;
}

/**
 * A button that opens a list of links — the sidebar's registry switcher. Base
 * UI owns the keyboard, focus and dismissal; this owns the popup's look.
 */
export function Menu({
	label,
	trigger,
	triggerClassName,
	children,
}: MenuProps) {
	return (
		<Base.Root>
			<Base.Trigger className={triggerClassName} aria-label={label}>
				{trigger}
			</Base.Trigger>
			<Base.Portal>
				<Base.Positioner
					className={styles.positioner}
					align="start"
					sideOffset={4}
				>
					<Base.Popup className={styles.popup}>{children}</Base.Popup>
				</Base.Positioner>
			</Base.Portal>
		</Base.Root>
	);
}

/**
 * One destination. `render` is the router's `<Link/>`, so the item keeps the
 * router's preloading and client-side navigation rather than a bare `<a>`.
 */
export function MenuLinkItem({
	render,
	children,
}: {
	render: ReactElement;
	children: ReactNode;
}) {
	return (
		<Base.LinkItem className={styles.item} render={render} closeOnClick>
			{children}
		</Base.LinkItem>
	);
}

export function MenuSeparator() {
	return <Base.Separator className={styles.separator} />;
}
