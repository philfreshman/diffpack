import { Menu as Base } from "@base-ui/react/menu";
import type { ReactElement, ReactNode } from "react";
import styles from "./Menu.module.css";

export interface MenuProps {
	label: string;
	trigger: ReactNode;
	triggerClassName?: string;
	children: ReactNode;
}
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

/** Pass the router's `<Link/>` as `render` to keep preloading and client navigation. */
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
