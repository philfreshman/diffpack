import * as THREE from "three";
import {
	advanceStarSky,
	createStarSky,
	disposeStarSky,
	fitStarSky,
	type StarSky,
} from "./starSky.ts";
import type { SkyView } from "./skyView.ts";

const SHOOTING_MIN_MS = 14000;
const SHOOTING_MAX_MS = 30000;

interface CameraSway {
	aim(event: PointerEvent): void;
	follow(seconds: number): void;
}

interface Frames {
	draw(now: number): void;
	launch(now: number): void;
}

export function startStarField(
	canvas: HTMLCanvasElement,
): (() => void) | undefined {
	// The CSS reduced-motion rule cannot reach a canvas loop: draw once and stop.
	const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	const renderer = createRenderer(canvas, still);
	if (!renderer) {
		// Without WebGL the CSS `--cosmic-backdrop` is the fallback sky.
		canvas.hidden = true;
		return;
	}

	const sky = createStarSky(renderer);
	const sway = createCameraSway(sky.camera);
	let view: SkyView = { width: 1, height: 1 };
	const resize = () => {
		view = fitStarSky(sky, canvas);
	};
	const frames = createFrames(sky, canvas, sway, () => view);

	resize();
	window.addEventListener("resize", resize);
	window.addEventListener("pointermove", sway.aim);
	const stopDrawing = still ? drawStill(frames, resize) : animate(frames);

	return () => {
		stopDrawing();
		window.removeEventListener("resize", resize);
		window.removeEventListener("pointermove", sway.aim);
		disposeStarSky(sky);
	};
}

function createRenderer(
	canvas: HTMLCanvasElement,
	still: boolean,
): THREE.WebGLRenderer | null {
	try {
		return new THREE.WebGLRenderer({
			canvas,
			antialias: false,
			// A still sky is drawn once, so its buffer must survive compositing.
			preserveDrawingBuffer: still,
		});
	} catch {
		return null;
	}
}

function createCameraSway(camera: THREE.Camera): CameraSway {
	const pointer = new THREE.Vector2(0, 0);
	const target = new THREE.Vector2(0, 0);
	return {
		aim(event) {
			target.set(
				(event.clientX / window.innerWidth) * 2 - 1,
				(event.clientY / window.innerHeight) * 2 - 1,
			);
		},
		// The camera slides away from the pointer and never rotates, so forwards
		// stays -z.
		follow(t) {
			pointer.lerp(target, 0.03);
			camera.position.x = -pointer.x * 0.5 + Math.sin(t / 17) * 0.5;
			camera.position.y = pointer.y * 0.3 + Math.cos(t / 23) * 0.35;
		},
	};
}

function createFrames(
	sky: StarSky,
	canvas: HTMLCanvasElement,
	sway: CameraSway,
	currentView: () => SkyView,
): Frames {
	let last = 0;
	let nextLaunchAt = Number.POSITIVE_INFINITY;

	const launch = (now: number) => {
		sky.shootingStars.launch(now, currentView());
		nextLaunchAt =
			now + SHOOTING_MIN_MS + sky.rng() * (SHOOTING_MAX_MS - SHOOTING_MIN_MS);
	};

	const draw = (now: number) => {
		const dt = last === 0 ? 0 : Math.min((now - last) / 1000, 0.05);
		last = now;
		advanceStarSky(sky, now, dt);
		sway.follow(now / 1000);
		if (now >= nextLaunchAt) launch(now);
		sky.shootingStars.move(now);
		sky.renderer.render(sky.scene, sky.camera);
		// The CSS fade-in waits for this, not for mount.
		canvas.dataset.drawn = "true";
	};

	return { draw, launch };
}

function drawStill(frames: Frames, resize: () => void): () => void {
	frames.draw(0);
	const redraw = () => {
		resize();
		frames.draw(0);
	};
	window.addEventListener("resize", redraw);
	return () => window.removeEventListener("resize", redraw);
}

function animate(frames: Frames): () => void {
	let frame = 0;
	const tick = (now: number) => {
		frames.draw(now);
		frame = requestAnimationFrame(tick);
	};
	frames.launch(performance.now());
	frame = requestAnimationFrame(tick);
	return () => cancelAnimationFrame(frame);
}
