// A port of `--cosmic-backdrop` in globals.css. Keep the two identical: the
// CSS one shows when WebGL is unavailable.
export const PURPLE: [number, number, number] = [88 / 255, 28 / 255, 135 / 255];
export const BLUE: [number, number, number] = [30 / 255, 58 / 255, 138 / 255];
const CORE_GREY = 5 / 255;

/** `cosmicShift` is 20s with `alternate`, so 40s round trip. */
const HUE_PERIOD_S = 40;
const HUE_SWING_RAD = (30 * Math.PI) / 180;

/** In `cosmicBackdrop(p, res, hue)`, `p` is 0..1 with y from the top, like CSS. */
export const COSMOS_GLSL = /* glsl */ `
const vec3 COSMOS_PURPLE = vec3(${PURPLE[0]}, ${PURPLE[1]}, ${PURPLE[2]});
const vec3 COSMOS_BLUE = vec3(${BLUE[0]}, ${BLUE[1]}, ${BLUE[2]});

// The SVG feColorMatrix hue rotation, which is what the CSS filter runs.
vec3 hueRotate(vec3 c, float a) {
	float s = sin(a);
	float k = cos(a);
	mat3 m = mat3(
		0.213 + k * 0.787 - s * 0.213, 0.213 - k * 0.213 + s * 0.143, 0.213 - k * 0.213 - s * 0.787,
		0.715 - k * 0.715 - s * 0.715, 0.715 + k * 0.285 + s * 0.140, 0.715 - k * 0.715 + s * 0.715,
		0.072 - k * 0.072 + s * 0.928, 0.072 - k * 0.072 - s * 0.283, 0.072 + k * 0.928 + s * 0.072
	);
	return m * c;
}

// \`radial-gradient(ellipse ...)\` with its default farthest-corner extent.
float cssEllipse(vec2 p, vec2 centre, vec2 res, float endStop) {
	vec2 radii = vec2(
		max(centre.x, 1.0 - centre.x) * res.x,
		max(centre.y, 1.0 - centre.y) * res.y
	) * 1.41421356;
	float d = length((p - centre) * res / radii);
	return clamp(1.0 - d / endStop, 0.0, 1.0);
}

vec3 cosmicBackdrop(vec2 p, vec2 res, float hue) {
	// Same layer order as the CSS: base, blue, purple.
	vec3 col = vec3(${CORE_GREY}) * cssEllipse(p, vec2(0.5), res, 1.0);
	col = mix(col, COSMOS_BLUE, 0.3 * cssEllipse(p, vec2(0.8, 0.7), res, 0.5));
	col = mix(col, COSMOS_PURPLE, 0.3 * cssEllipse(p, vec2(0.2, 0.3), res, 0.5));
	return hueRotate(col, hue);
}
`;

export function hueAt(seconds: number): number {
	const t = (Math.PI * 2 * seconds) / HUE_PERIOD_S;
	return HUE_SWING_RAD * (0.5 - 0.5 * Math.cos(t));
}
