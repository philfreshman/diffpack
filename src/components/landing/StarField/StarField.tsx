import { useEffect, useRef } from "react";
import { useResolvedTheme } from "#/components/theme/useResolvedTheme.ts";
import { startStarField } from "./starFieldLoop.ts";
import styles from "./StarField.module.css";

export function StarField() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const theme = useResolvedTheme();

	useEffect(() => {
		if (theme !== "dark") return;
		const canvas = canvasRef.current;
		if (!canvas) return;
		return startStarField(canvas);
	}, [theme]);

	if (theme !== "dark") return null;

	return (
		<canvas
			ref={canvasRef}
			className={styles.starField}
			data-testid="star-field"
			aria-hidden="true"
		/>
	);
}
