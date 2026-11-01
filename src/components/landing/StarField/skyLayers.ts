import * as THREE from "three";
import { CLOUD_GLSL } from "#/lib/starfield/clouds.ts";
import { BLUE, COSMOS_GLSL, PURPLE } from "#/lib/starfield/cosmos.ts";
import {
	type DiffMark,
	FIELD_HALF,
	generateMarks,
	MARK_COUNT,
} from "#/lib/starfield/field.ts";
import { MARK_FRAGMENT, MARK_VERTEX, SPRITE_VERTEX } from "./skyShaders.ts";
import { halfHeightAt } from "./skyView.ts";

// Far enough that the camera's slide never reaches it.
const CLOUD_RADIUS = 150;

export interface Backdrop {
	hue: THREE.IUniform<number>;
	fit(width: number, height: number, aspect: number): void;
	dispose(): void;
}

export interface Clouds {
	time: THREE.IUniform<number>;
	flow: THREE.IUniform<THREE.Vector3>;
	dispose(): void;
}

export interface Marks {
	time: THREE.IUniform<number>;
	pixelRatio: THREE.IUniform<number>;
	offset: THREE.IUniform<THREE.Vector3>;
	dispose(): void;
}

export function createBackdrop(camera: THREE.Camera): Backdrop {
	// Repeats `--cosmic-backdrop` in GLSL, since the canvas covers the CSS one.
	const uRes = { value: new THREE.Vector2(1, 1) };
	const uHue = { value: 0 };
	const material = new THREE.ShaderMaterial({
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
	const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
	mesh.position.z = -1;
	mesh.renderOrder = -2;
	camera.add(mesh);

	return {
		hue: uHue,
		fit(width, height, aspect) {
			uRes.value.set(width, height);
			const h = 2 * halfHeightAt(1);
			mesh.scale.set(h * aspect, h, 1);
		},
		dispose() {
			mesh.geometry.dispose();
			material.dispose();
		},
	};
}

// The drift moves the field, not the camera, so a sphere at the origin
// always surrounds the viewer.
export function createClouds(scene: THREE.Scene): Clouds {
	const uTime = { value: 0 };
	const uFlow = { value: new THREE.Vector3() };
	const geometry = new THREE.SphereGeometry(CLOUD_RADIUS, 48, 24);
	const material = createCloudMaterial(uTime, uFlow);
	const clouds = new THREE.Mesh(geometry, material);
	// Tilted so the cloud band does not look like a seam across the screen.
	clouds.rotation.set(0.16, 0, 0.42);
	clouds.renderOrder = -1;
	scene.add(clouds);

	return {
		time: uTime,
		flow: uFlow,
		dispose() {
			geometry.dispose();
			material.dispose();
		},
	};
}

function createCloudMaterial(
	uTime: THREE.IUniform<number>,
	uFlow: THREE.IUniform<THREE.Vector3>,
): THREE.ShaderMaterial {
	return new THREE.ShaderMaterial({
		uniforms: {
			uTime,
			uFlow,
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
}

export function createMarks(scene: THREE.Scene, rng: () => number): Marks {
	const geometry = createMarkGeometry(generateMarks(MARK_COUNT, rng));
	const uTime = { value: 0 };
	const uPixelRatio = { value: 1 };
	const uOffset = { value: new THREE.Vector3() };
	const material = new THREE.ShaderMaterial({
		uniforms: { uTime, uPixelRatio, uOffset },
		vertexShader: MARK_VERTEX,
		fragmentShader: MARK_FRAGMENT,
		transparent: true,
		depthTest: false,
		depthWrite: false,
		blending: THREE.AdditiveBlending,
	});
	scene.add(new THREE.Points(geometry, material));

	return {
		time: uTime,
		pixelRatio: uPixelRatio,
		offset: uOffset,
		dispose() {
			geometry.dispose();
			material.dispose();
		},
	};
}

function createMarkGeometry(marks: readonly DiffMark[]): THREE.BufferGeometry {
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
	return geometry;
}
