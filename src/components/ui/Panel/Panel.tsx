import type { ComponentProps } from "react";
import styles from "./Panel.module.css";

export function Panel({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			className={className ? `${styles.panel} ${className}` : styles.panel}
			{...props}
		/>
	);
}

export function PanelHeading({
	className,
	children,
	...props
}: ComponentProps<"h2">) {
	return (
		<h2
			className={className ? `${styles.heading} ${className}` : styles.heading}
			{...props}
		>
			{children}
		</h2>
	);
}
