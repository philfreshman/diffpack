import styles from "./Kbd.module.css";

/**
 * The key that jumps to a field, drawn inside it the way a dashboard marks its
 * Find. The field also states the key in `aria-keyshortcuts`, which is what
 * assistive technology announces.
 *
 * `className` is for placement; the caller decides where in the field it sits
 * and when it stands down.
 */
export function Kbd({ keys, className }: { keys: string; className?: string }) {
	return (
		<kbd className={className ? `${styles.kbd} ${className}` : styles.kbd}>
			{keys}
		</kbd>
	);
}
