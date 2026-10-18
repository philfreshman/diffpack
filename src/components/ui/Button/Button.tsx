import { Button as Base } from "@base-ui/react/button";
import type { ComponentPropsWithoutRef } from "react";
import styles from "./Button.module.css";

/** `className` is for placement, not restyling; it is appended so it wins ties. */
export interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
	variant?: "primary" | "neutral";
}

export function Button({
	variant = "neutral",
	className,
	children,
	...props
}: ButtonProps) {
	return (
		<Base
			className={className ? `${styles.button} ${className}` : styles.button}
			data-variant={variant}
			{...props}
		>
			{children}
		</Base>
	);
}
