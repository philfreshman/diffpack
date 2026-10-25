import type { ReactNode } from "react";
import styles from "./PageTitle.module.css";

type PageTitleSize = "regular" | "hero";

export function PageTitle({
	children,
	size = "regular",
}: {
	children: ReactNode;
	size?: PageTitleSize;
}) {
	return (
		<h1 className={styles.title} data-size={size}>
			{children}
		</h1>
	);
}
