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
