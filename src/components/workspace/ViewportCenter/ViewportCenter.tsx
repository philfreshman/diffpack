import type { ReactNode } from "react";
import styles from "./ViewportCenter.module.css";

export function ViewportCenter({ children }: { children: ReactNode }) {
	return (
		<div className={styles.stage}>
			<div className={styles.slot}>{children}</div>
		</div>
	);
}
