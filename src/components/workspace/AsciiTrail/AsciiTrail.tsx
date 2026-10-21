import { useEffect, useRef } from "react";
import styles from "./AsciiTrail.module.css";
import { startAsciiTrail } from "./asciiTrailLoop.ts";

const MOUSE_WITHOUT_REDUCED_MOTION =
	"(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

export function AsciiTrail() {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || !window.matchMedia(MOUSE_WITHOUT_REDUCED_MOTION).matches)
			return;
		return startAsciiTrail(canvas);
	}, []);

	return (
		// biome-ignore lint/a11y/noAriaHiddenOnFocusable: a canvas carries no tabindex, so it is not focusable
		<canvas
			ref={canvasRef}
			className={styles.trail}
			data-testid="ascii-trail"
			aria-hidden="true"
		/>
	);
}
