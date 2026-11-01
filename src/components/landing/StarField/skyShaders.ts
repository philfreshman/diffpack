import { FIELD_HALF } from "#/lib/starfield/field.ts";

// Marks must be faded out before they reach the wrap at FIELD_HALF.
const FADE_START = 24;
const FADE_END = 35;

export const MARK_VERTEX = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute float aPeriod;
attribute float aPlus;
uniform float uTime;
uniform float uPixelRatio;
uniform vec3 uOffset;
varying float vAlpha;
varying float vSize;
varying float vPlus;

const float HALF = ${FIELD_HALF}.0;

void main() {
	// Drift as an offset and a modulo, so the position buffer is never re-uploaded.
	vec3 wrapped = mod(position + uOffset + HALF, 2.0 * HALF) - HALF;
	vec4 mv = modelViewMatrix * vec4(wrapped, 1.0);
	float depth = -mv.z;

	float pulse = 0.5 + 0.5 * sin((uTime / aPeriod + aPhase) * 6.2831853);
	vAlpha = 0.5 + pulse * 0.5;
	vAlpha *= smoothstep(4.5, 11.0, depth) * mix(0.7, 1.0, smoothstep(11.0, 24.0, depth));
	vAlpha *= 1.0 - smoothstep(${FADE_START}.0, ${FADE_END}.0, depth);

	// Keep the size pulse tiny: a breathing glyph reads as a wobble.
	gl_PointSize = clamp(
		aSize * (1.0 + pulse * 0.12) * uPixelRatio * (95.0 / depth),
		uPixelRatio * 2.2,
		uPixelRatio * 14.0
	);
	vSize = gl_PointSize;
	vPlus = aPlus;
	gl_Position = projectionMatrix * mv;
}
`;

export const MARK_FRAGMENT = /* glsl */ `
varying float vAlpha;
varying float vSize;
varying float vPlus;

float box(vec2 p, vec2 halfSize) {
	vec2 d = abs(p) - halfSize;
	return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

void main() {
	vec2 p = gl_PointCoord - 0.5;
	float d = box(p, vec2(0.32, 0.085));
	if (vPlus > 0.5) d = min(d, box(p, vec2(0.085, 0.32)));

	// One pixel in sprite units; it also blurs distant marks into soft specks.
	float aa = max(1.2 / vSize, 0.02);
	float glyph = 1.0 - smoothstep(-aa, aa, d);
	float halo = pow(smoothstep(0.44, 0.02, length(p)), 1.6) * 0.32;

	float a = min(1.0, glyph + halo) * vAlpha;
	if (a < 0.004) discard;
	gl_FragColor = vec4(1.0, 1.0, 1.0, a);
}
`;

export const SPRITE_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
	vUv = uv;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const STREAK_FRAGMENT = /* glsl */ `
varying vec2 vUv;
uniform float uAlpha;

void main() {
	float along = vUv.x;
	float across = abs(vUv.y - 0.5) * 2.0;
	float core = smoothstep(1.0, 0.0, across);
	float tail = pow(along, 3.0) * core * 0.5;
	float head = smoothstep(0.86, 1.0, along) * core * core;
	gl_FragColor = vec4(1.0, 1.0, 1.0, (tail + head) * uAlpha);
}
`;
