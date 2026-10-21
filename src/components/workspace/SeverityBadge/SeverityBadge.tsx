import type { Severity } from "#/lib/vulnerabilities/types.ts";
import styles from "./SeverityBadge.module.css";

const SEVERITY_NAMES: Record<Severity, string> = {
	critical: "Critical",
	high: "High",
	moderate: "Moderate",
	low: "Low",
	unknown: "Unrated",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
	return (
		<span className={styles.badge} data-severity={severity}>
			{SEVERITY_NAMES[severity]}
		</span>
	);
}
