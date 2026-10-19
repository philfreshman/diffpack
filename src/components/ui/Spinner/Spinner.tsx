import styles from "./Spinner.module.css";

export function Spinner({ label = "Loading" }: { label?: string }) {
	return (
		<span className={styles.spinner} role="status" aria-label={label}>
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				aria-hidden="true"
			>
				<circle cx="12" cy="12" r="9" opacity="0.25" />
				<path d="M21 12a9 9 0 0 0-9-9" />
			</svg>
		</span>
	);
}
