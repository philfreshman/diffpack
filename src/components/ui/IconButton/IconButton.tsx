import { Button } from "@base-ui/react/button";
import type { ComponentPropsWithoutRef } from "react";
import styles from "./IconButton.module.css";

/** `className` is for placement, not restyling; it is appended so it wins ties. */
export interface IconButtonProps extends ComponentPropsWithoutRef<"button"> {
	"aria-label": string;
}

export function IconButton({ children, className, ...props }: IconButtonProps) {
	return (
		<Button
			className={
				className ? `${styles.iconButton} ${className}` : styles.iconButton
			}
			{...props}
		>
			{children}
		</Button>
	);
}
