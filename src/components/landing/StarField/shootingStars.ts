import * as THREE from "three";
import { SPRITE_VERTEX, STREAK_FRAGMENT } from "./skyShaders.ts";
import { halfHeightAt, type SkyView } from "./skyView.ts";

const SHOOTING_POOL = 2;
const SHOOTING_LIFETIME_MS = 3000;

interface Streak {
	mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
	// Held here because `material.uniforms` is an index signature.
	alpha: { value: number };
	startedAt: number;
	from: THREE.Vector3;
	travel: number;
}

export interface ShootingStars {
	launch(now: number, view: SkyView): void;
	move(now: number): void;
	dispose(): void;
}

export function createShootingStars(
	scene: THREE.Scene,
	rng: () => number,
): ShootingStars {
	const geometry = new THREE.PlaneGeometry(1, 1);
	const streaks: Streak[] = [];
	const idle: Streak[] = [];
	for (let i = 0; i < SHOOTING_POOL; i += 1) {
		const streak = createStreak(geometry);
		scene.add(streak.mesh);
		idle.push(streak);
	}

	return {
		launch(now, view) {
			const streak = idle.pop();
			if (!streak) return;
			aimStreak(streak, now, view, rng);
			streaks.push(streak);
		},
		move(now) {
			for (let i = streaks.length - 1; i >= 0; i -= 1) {
				const streak = streaks[i];
				if (!streak) continue;
				const life = (now - streak.startedAt) / SHOOTING_LIFETIME_MS;
				if (life < 1) {
					placeStreak(streak, life);
					continue;
				}
				streak.mesh.visible = false;
				streaks.splice(i, 1);
				idle.push(streak);
			}
		},
		dispose() {
			geometry.dispose();
			for (const streak of [...streaks, ...idle])
				streak.mesh.material.dispose();
		},
	};
}

function createStreak(geometry: THREE.PlaneGeometry): Streak {
	const uAlpha = { value: 0 };
	const mesh = new THREE.Mesh(
		geometry,
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
	return {
		mesh,
		alpha: uAlpha,
		startedAt: 0,
		from: new THREE.Vector3(),
		travel: 0,
	};
}

function aimStreak(
	streak: Streak,
	now: number,
	{ width, height }: SkyView,
	rng: () => number,
): void {
	const z = -10 - rng() * 26;
	const halfH = halfHeightAt(z);
	const halfW = halfH * (width / height);
	streak.from.set(-halfW + rng() * halfW, halfH - rng() * halfH, z);
	// 300px of screen travel at this star's depth.
	streak.travel = (300 / height) * halfH * 2;
	streak.startedAt = now;
	streak.mesh.visible = true;
	streak.mesh.scale.set(halfH * 0.5, halfH * 0.012, 1);
}

function placeStreak(streak: Streak, life: number): void {
	const d = life * streak.travel;
	streak.mesh.position.set(streak.from.x + d, streak.from.y - d, streak.from.z);
	streak.alpha.value = life < 0.1 ? life * 10 : 1 - life;
}
