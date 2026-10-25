import type { CSSProperties } from "react";
import styles from "./RiseIn.module.css";

const STAGGER_MS = 2;
const STAGGER_CAP = 30;

function riseInDelay(position: number): string {
	return `${Math.min(position, STAGGER_CAP) * STAGGER_MS}ms`;
}

export function risesIn(
	className: string | undefined,
	position: number,
): { className: string; style: CSSProperties } {
	return {
		className: [className, styles.riseIn].filter(Boolean).join(" "),
		style: { animationDelay: riseInDelay(position) },
	};
}
