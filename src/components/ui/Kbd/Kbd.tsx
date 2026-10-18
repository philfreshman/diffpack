import styles from "./Kbd.module.css";

export function Kbd({ keys, className }: { keys: string; className?: string }) {
	return (
		<kbd className={className ? `${styles.kbd} ${className}` : styles.kbd}>
			{keys}
		</kbd>
	);
}
