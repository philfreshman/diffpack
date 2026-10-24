import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useResolvedTheme } from "#/components/theme/useResolvedTheme.ts";
import { CLOUD_GLSL } from "#/lib/starfield/clouds.ts";
import { BLUE, COSMOS_GLSL, hueAt, PURPLE } from "#/lib/starfield/cosmos.ts";
import {
	createRng,
	FIELD_HALF,
	FIELD_SEED,
	generateMarks,
	MARK_COUNT,
} from "#/lib/starfield/field.ts";
import styles from "./StarField.module.css";

const FOV = 60;
// Marks must be faded out before they reach the wrap at FIELD_HALF.
const FADE_START = 24;
const FADE_END = 35;
const DRIFT_SPEED = 0.9;
// Far enough that the camera's slide never reaches it.
const CLOUD_RADIUS = 150;

const SHOOTING_MIN_MS = 14000;
const SHOOTING_MAX_MS = 30000;
const SHOOTING_LIFETIME_MS = 3000;
const SHOOTING_POOL = 2;

const MARK_VERTEX = /* glsl */ `
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

const MARK_FRAGMENT = /* glsl */ `
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

const SPRITE_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
	vUv = uv;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const STREAK_FRAGMENT = /* glsl */ `
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

interface Streak {
	mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
	// Held here because `material.uniforms` is an index signature.
	alpha: { value: number };
	startedAt: number;
	from: THREE.Vector3;
	travel: number;
}

export function StarField() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const theme = useResolvedTheme();
	const [webglFailed, setWebglFailed] = useState(false);

	useEffect(() => {
		if (theme !== "dark") return;
		const canvas = canvasRef.current;
		if (!canvas) return;

		// The CSS reduced-motion rule cannot reach a canvas loop: draw once and stop.
		const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

		let renderer: THREE.WebGLRenderer;
		try {
			renderer = new THREE.WebGLRenderer({
				canvas,
				antialias: false,
				// A still sky is drawn once, so its buffer must survive compositing.
				preserveDrawingBuffer: still,
			});
		} catch {
			setWebglFailed(true);
			return;
		}

		renderer.setClearColor(0x000000, 1);
		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 400);
		scene.add(camera);

		// Repeats `--cosmic-backdrop` in GLSL, since the canvas covers the CSS one.
		const uRes = { value: new THREE.Vector2(1, 1) };
		const uHue = { value: 0 };
		const backdropMaterial = new THREE.ShaderMaterial({
			uniforms: { uRes, uHue },
			vertexShader: SPRITE_VERTEX,
			fragmentShader: /* glsl */ `
				varying vec2 vUv;
				uniform vec2 uRes;
				uniform float uHue;
				${COSMOS_GLSL}
				void main() {
					gl_FragColor = vec4(cosmicBackdrop(vec2(vUv.x, 1.0 - vUv.y), uRes, uHue), 1.0);
				}
			`,
			depthTest: false,
			depthWrite: false,
		});
		const backdrop = new THREE.Mesh(
			new THREE.PlaneGeometry(1, 1),
			backdropMaterial,
		);
		backdrop.position.z = -1;
		backdrop.renderOrder = -2;
		camera.add(backdrop);

		// The drift moves the field, not the camera, so a sphere at the origin
		// always surrounds the viewer.
		const uCloudTime = { value: 0 };
		const uCloudFlow = { value: new THREE.Vector3() };
		const cloudGeometry = new THREE.SphereGeometry(CLOUD_RADIUS, 48, 24);
		const cloudMaterial = new THREE.ShaderMaterial({
			uniforms: {
				uTime: uCloudTime,
				uFlow: uCloudFlow,
				uPurple: { value: new THREE.Color(...PURPLE) },
				uBlue: { value: new THREE.Color(...BLUE) },
			},
			vertexShader: /* glsl */ `
				varying vec3 vDir;
				void main() {
					vDir = position;
					gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
				}
			`,
			fragmentShader: /* glsl */ `
				varying vec3 vDir;
				uniform float uTime;
				uniform vec3 uFlow;
				uniform vec3 uPurple;
				uniform vec3 uBlue;
				${CLOUD_GLSL}
				void main() {
					gl_FragColor = vec4(
						nebula(normalize(vDir), uTime, uFlow, uPurple, uBlue),
						1.0
					);
				}
			`,
			side: THREE.BackSide,
			depthTest: false,
			depthWrite: false,
			transparent: true,
			blending: THREE.AdditiveBlending,
		});
		const clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
		// Tilted so the cloud band does not look like a seam across the screen.
		clouds.rotation.set(0.16, 0, 0.42);
		clouds.renderOrder = -1;
		scene.add(clouds);

		const rng = createRng(FIELD_SEED);
		const marks = generateMarks(MARK_COUNT, rng);
		const positions = new Float32Array(MARK_COUNT * 3);
		const sizes = new Float32Array(MARK_COUNT);
		const phases = new Float32Array(MARK_COUNT);
		const periods = new Float32Array(MARK_COUNT);
		const pluses = new Float32Array(MARK_COUNT);
		for (let i = 0; i < MARK_COUNT; i += 1) {
			const mark = marks[i];
			if (!mark) continue;
			positions[i * 3] = mark.x;
			positions[i * 3 + 1] = mark.y;
			positions[i * 3 + 2] = mark.z;
			sizes[i] = mark.size;
			phases[i] = mark.phase;
			periods[i] = mark.periodMs;
			pluses[i] = mark.plus ? 1 : 0;
		}

		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
		geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
		geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
		geometry.setAttribute("aPeriod", new THREE.BufferAttribute(periods, 1));
		geometry.setAttribute("aPlus", new THREE.BufferAttribute(pluses, 1));
		// The cube wraps, so culling against the starting bounds would hide marks.
		geometry.boundingSphere = new THREE.Sphere(
			new THREE.Vector3(),
			FIELD_HALF * 2,
		);

		const uTime = { value: 0 };
		const uPixelRatio = { value: 1 };
		const uOffset = { value: new THREE.Vector3() };
		const markMaterial = new THREE.ShaderMaterial({
			uniforms: { uTime, uPixelRatio, uOffset },
			vertexShader: MARK_VERTEX,
			fragmentShader: MARK_FRAGMENT,
			transparent: true,
			depthTest: false,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
		});
		scene.add(new THREE.Points(geometry, markMaterial));

		const streakGeometry = new THREE.PlaneGeometry(1, 1);
		const streaks: Streak[] = [];
		const idle: Streak[] = [];
		for (let i = 0; i < SHOOTING_POOL; i += 1) {
			const uAlpha = { value: 0 };
			const mesh = new THREE.Mesh(
				streakGeometry,
				new THREE.ShaderMaterial({
					uniforms: { uAlpha },
					vertexShader: SPRITE_VERTEX,
					fragmentShader: STREAK_FRAGMENT,
					transparent: true,
					depthTest: false,
					depthWrite: false,
					blending: THREE.AdditiveBlending,
				}),
			);
			mesh.visible = false;
			mesh.rotation.z = -Math.PI / 4;
			scene.add(mesh);
			idle.push({
				mesh,
				alpha: uAlpha,
				startedAt: 0,
				from: new THREE.Vector3(),
				travel: 0,
			});
		}

		let width = 1;
		let height = 1;
		const halfHeightAt = (z: number) =>
			Math.tan((FOV * Math.PI) / 360) * Math.abs(z);

		const resize = () => {
			width = canvas.clientWidth;
			height = canvas.clientHeight;
			const ratio = Math.min(window.devicePixelRatio || 1, 2);
			renderer.setPixelRatio(ratio);
			renderer.setSize(width, height, false);
			camera.aspect = width / height;
			camera.updateProjectionMatrix();
			uPixelRatio.value = ratio;
			uRes.value.set(width, height);
			const h = 2 * halfHeightAt(1);
			backdrop.scale.set(h * camera.aspect, h, 1);
		};

		const launch = (now: number) => {
			const streak = idle.pop();
			if (!streak) return;
			const z = -10 - rng() * 26;
			const halfH = halfHeightAt(z);
			const halfW = halfH * (width / height);
			streak.from.set(-halfW + rng() * halfW, halfH - rng() * halfH, z);
			// 300px of screen travel at this star's depth.
			streak.travel = (300 / height) * halfH * 2;
			streak.startedAt = now;
			streak.mesh.visible = true;
			streak.mesh.scale.set(halfH * 0.5, halfH * 0.012, 1);
			streaks.push(streak);
		};

		const pointer = new THREE.Vector2(0, 0);
		const target = new THREE.Vector2(0, 0);
		const onPointerMove = (event: PointerEvent) => {
			target.set(
				(event.clientX / window.innerWidth) * 2 - 1,
				(event.clientY / window.innerHeight) * 2 - 1,
			);
		};

		let last = 0;
		let nextLaunchAt = Number.POSITIVE_INFINITY;

		const draw = (now: number) => {
			const dt = last === 0 ? 0 : Math.min((now - last) / 1000, 0.05);
			last = now;

			const t = now / 1000;
			uTime.value = now;
			uHue.value = hueAt(t);
			uCloudTime.value = t;

			// The camera slides away from the pointer and never rotates, so forwards
			// stays -z.
			pointer.lerp(target, 0.03);
			camera.position.x = -pointer.x * 0.5 + Math.sin(t / 17) * 0.5;
			camera.position.y = pointer.y * 0.3 + Math.cos(t / 23) * 0.35;

			uOffset.value.z += DRIFT_SPEED * dt;
			// Wrapped here too, or float precision erodes over a long session.
			uOffset.value.z %= FIELD_HALF * 2;
			uCloudFlow.value.set(0, 0, uOffset.value.z * 0.004);

			if (now >= nextLaunchAt) {
				launch(now);
				nextLaunchAt =
					now + SHOOTING_MIN_MS + rng() * (SHOOTING_MAX_MS - SHOOTING_MIN_MS);
			}

			for (let i = streaks.length - 1; i >= 0; i -= 1) {
				const streak = streaks[i];
				if (!streak) continue;
				const life = (now - streak.startedAt) / SHOOTING_LIFETIME_MS;
				if (life >= 1) {
					streak.mesh.visible = false;
					streaks.splice(i, 1);
					idle.push(streak);
					continue;
				}
				const d = life * streak.travel;
				streak.mesh.position.set(
					streak.from.x + d,
					streak.from.y - d,
					streak.from.z,
				);
				streak.alpha.value = life < 0.1 ? life * 10 : 1 - life;
			}

			renderer.render(scene, camera);
			// The CSS fade-in waits for this, not for mount.
			canvas.dataset.drawn = "true";
		};

		const dispose = () => {
			geometry.dispose();
			markMaterial.dispose();
			cloudGeometry.dispose();
			cloudMaterial.dispose();
			streakGeometry.dispose();
			for (const streak of [...streaks, ...idle])
				streak.mesh.material.dispose();
			backdrop.geometry.dispose();
			backdropMaterial.dispose();
			renderer.dispose();
		};

		resize();
		window.addEventListener("resize", resize);
		window.addEventListener("pointermove", onPointerMove);

		if (still) {
			draw(0);
			const redraw = () => {
				resize();
				draw(0);
			};
			window.addEventListener("resize", redraw);
			return () => {
				window.removeEventListener("resize", resize);
				window.removeEventListener("resize", redraw);
				window.removeEventListener("pointermove", onPointerMove);
				dispose();
			};
		}

		let frame = 0;
		const tick = (now: number) => {
			draw(now);
			frame = requestAnimationFrame(tick);
		};
		const start = performance.now();
		launch(start);
		nextLaunchAt =
			start + SHOOTING_MIN_MS + rng() * (SHOOTING_MAX_MS - SHOOTING_MIN_MS);
		frame = requestAnimationFrame(tick);

		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener("resize", resize);
			window.removeEventListener("pointermove", onPointerMove);
			dispose();
		};
	}, [theme]);

	// Without WebGL the CSS `--cosmic-backdrop` is the fallback sky.
	if (theme !== "dark" || webglFailed) return null;

	return (
		<canvas
			ref={canvasRef}
			className={styles.starField}
			data-testid="star-field"
			aria-hidden="true"
		/>
	);
}
