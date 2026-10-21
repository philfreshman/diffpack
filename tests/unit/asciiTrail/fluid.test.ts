import { describe, expect, test } from "bun:test";
import {
	createFluidGrid,
	densityAt,
	type FluidSettings,
	isSettled,
	type Stir,
	stepFluid,
	stirFluid,
} from "#/lib/asciiTrail/fluid.ts";

const SETTINGS: FluidSettings = {
	diffusion: 1.5,
	diffusionIterations: 5,
	projectionIterations: 10,
	velocityFadePerSecond: 1,
	densityFadePerSecond: 0.6,
};

const SETTLED_INK = 0.01;

const STILL_DROP: Stir = {
	column: 10,
	row: 10,
	radius: 3,
	pushX: 0,
	pushY: 0,
	ink: 1,
};

function totalInk(grid: ReturnType<typeof createFluidGrid>): number {
	return grid.density.reduce((sum, ink) => sum + ink, 0);
}

function runFor(
	grid: ReturnType<typeof createFluidGrid>,
	seconds: number,
): void {
	const frame = 1 / 30;
	for (let elapsed = 0; elapsed < seconds; elapsed += frame) {
		stepFluid(grid, frame, SETTINGS);
	}
}

describe("stirFluid", () => {
	test("drops the most ink where the pointer is", () => {
		const grid = createFluidGrid(20, 20);
		stirFluid(grid, STILL_DROP);

		expect(densityAt(grid, 10, 10)).toBe(1);
		expect(densityAt(grid, 12, 10)).toBeGreaterThan(0);
		expect(densityAt(grid, 12, 10)).toBeLessThan(1);
		expect(densityAt(grid, 14, 10)).toBe(0);
	});

	test("never fills a cell past full", () => {
		const grid = createFluidGrid(20, 20);
		for (let drop = 0; drop < 5; drop += 1) stirFluid(grid, STILL_DROP);

		expect(Math.max(...grid.density)).toBe(1);
	});

	test("reads between cells by blending their ink", () => {
		const grid = createFluidGrid(20, 20);
		stirFluid(grid, STILL_DROP);

		const between = densityAt(grid, 10.5, 10);
		expect(between).toBeCloseTo(
			(densityAt(grid, 10, 10) + densityAt(grid, 11, 10)) / 2,
		);
	});

	test("reaches cells at the edge without writing outside the grid", () => {
		const grid = createFluidGrid(8, 8);
		stirFluid(grid, { ...STILL_DROP, column: 0, row: 7 });

		expect(densityAt(grid, 0, 7)).toBe(1);
		expect(grid.density).toHaveLength(64);
	});
});

describe("stepFluid", () => {
	test("fades the ink until the grid settles", () => {
		const grid = createFluidGrid(20, 20);
		stirFluid(grid, STILL_DROP);
		expect(isSettled(grid, SETTLED_INK)).toBe(false);

		runFor(grid, 10);

		expect(isSettled(grid, SETTLED_INK)).toBe(true);
	});

	test("counts ink too faint to draw as settled", () => {
		const grid = createFluidGrid(20, 20);
		stirFluid(grid, { ...STILL_DROP, ink: 0.2 });

		expect(isSettled(grid, 0.3)).toBe(true);
		expect(isSettled(grid, 0.1)).toBe(false);
	});

	test("carries the ink along the direction it was pushed", () => {
		const grid = createFluidGrid(40, 20);
		stirFluid(grid, { ...STILL_DROP, pushX: 40 });

		runFor(grid, 0.3);

		const ahead = densityAt(grid, 13, 10);
		const behind = densityAt(grid, 7, 10);
		expect(ahead).toBeGreaterThan(behind);
	});

	test("never adds ink on its own", () => {
		const grid = createFluidGrid(20, 20);
		stirFluid(grid, { ...STILL_DROP, pushX: 30, pushY: -20 });
		const before = totalInk(grid);

		runFor(grid, 0.5);

		expect(totalInk(grid)).toBeLessThan(before);
	});

	test("treats a stalled frame as one short step", () => {
		const stalled = createFluidGrid(20, 20);
		const smooth = createFluidGrid(20, 20);
		stirFluid(stalled, STILL_DROP);
		stirFluid(smooth, STILL_DROP);

		stepFluid(stalled, 5, SETTINGS);
		stepFluid(smooth, 0.1, SETTINGS);

		expect(stalled.density).toEqual(smooth.density);
	});
});
