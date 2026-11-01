import * as THREE from "three";
import { hueAt } from "#/lib/starfield/cosmos.ts";
import { createRng, FIELD_HALF, FIELD_SEED } from "#/lib/starfield/field.ts";
import { createShootingStars, type ShootingStars } from "./shootingStars.ts";
import {
	type Backdrop,
	type Clouds,
	createBackdrop,
	createClouds,
	createMarks,
	type Marks,
} from "./skyLayers.ts";
import { FOV, type SkyView } from "./skyView.ts";

const DRIFT_SPEED = 0.9;
const MAX_PIXEL_RATIO = 2;

export interface StarSky {
	renderer: THREE.WebGLRenderer;
	scene: THREE.Scene;
	camera: THREE.PerspectiveCamera;
	backdrop: Backdrop;
	clouds: Clouds;
	marks: Marks;
	shootingStars: ShootingStars;
	rng: () => number;
}

export function createStarSky(renderer: THREE.WebGLRenderer): StarSky {
	renderer.setClearColor(0x000000, 1);
	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 400);
	scene.add(camera);
	const backdrop = createBackdrop(camera);
	const clouds = createClouds(scene);
	const rng = createRng(FIELD_SEED);
	const marks = createMarks(scene, rng);
	const shootingStars = createShootingStars(scene, rng);
	return {
		renderer,
		scene,
		camera,
		backdrop,
		clouds,
		marks,
		shootingStars,
		rng,
	};
}

export function fitStarSky(sky: StarSky, canvas: HTMLCanvasElement): SkyView {
	const { renderer, camera } = sky;
	const width = canvas.clientWidth;
	const height = canvas.clientHeight;
	const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
	renderer.setPixelRatio(ratio);
	renderer.setSize(width, height, false);
	camera.aspect = width / height;
	camera.updateProjectionMatrix();
	sky.marks.pixelRatio.value = ratio;
	sky.backdrop.fit(width, height, camera.aspect);
	return { width, height };
}

export function advanceStarSky(sky: StarSky, now: number, dt: number): void {
	const t = now / 1000;
	sky.marks.time.value = now;
	sky.backdrop.hue.value = hueAt(t);
	sky.clouds.time.value = t;

	const offset = sky.marks.offset.value;
	offset.z += DRIFT_SPEED * dt;
	// Wrapped here too, or float precision erodes over a long session.
	offset.z %= FIELD_HALF * 2;
	sky.clouds.flow.value.set(0, 0, offset.z * 0.004);
}

export function disposeStarSky(sky: StarSky): void {
	sky.marks.dispose();
	sky.clouds.dispose();
	sky.shootingStars.dispose();
	sky.backdrop.dispose();
	sky.renderer.dispose();
}
