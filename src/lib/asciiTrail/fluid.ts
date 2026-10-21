export interface FluidGrid {
	readonly columns: number;
	readonly rows: number;
	readonly velocityX: Float32Array;
	readonly velocityY: Float32Array;
	readonly density: Float32Array;
	readonly previousX: Float32Array;
	readonly previousY: Float32Array;
	readonly previousDensity: Float32Array;
	readonly pressure: Float32Array;
	readonly divergence: Float32Array;
}

export interface FluidSettings {
	diffusion: number;
	diffusionIterations: number;
	projectionIterations: number;
	velocityFadePerSecond: number;
	densityFadePerSecond: number;
}

export interface Stir {
	column: number;
	row: number;
	radius: number;
	pushX: number;
	pushY: number;
	ink: number;
}

const LONGEST_STEP_SECONDS = 0.1;

export function createFluidGrid(columns: number, rows: number): FluidGrid {
	const size = columns * rows;
	const field = () => new Float32Array(size);
	return {
		columns,
		rows,
		velocityX: field(),
		velocityY: field(),
		density: field(),
		previousX: field(),
		previousY: field(),
		previousDensity: field(),
		pressure: field(),
		divergence: field(),
	};
}

export function stirFluid(grid: FluidGrid, stir: Stir): void {
	const first = clampColumn(grid, Math.floor(stir.column - stir.radius));
	const last = clampColumn(grid, Math.ceil(stir.column + stir.radius));
	const top = clampRow(grid, Math.floor(stir.row - stir.radius));
	const bottom = clampRow(grid, Math.ceil(stir.row + stir.radius));

	for (let row = top; row <= bottom; row += 1) {
		for (let column = first; column <= last; column += 1) {
			const distance = Math.hypot(column - stir.column, row - stir.row);
			const weight = smoothFalloff(distance / stir.radius);
			if (weight <= 0) continue;
			const cell = cellIndex(grid, column, row);
			grid.velocityX[cell] = at(grid.velocityX, cell) + stir.pushX * weight;
			grid.velocityY[cell] = at(grid.velocityY, cell) + stir.pushY * weight;
			grid.density[cell] = Math.min(
				1,
				at(grid.density, cell) + stir.ink * weight,
			);
		}
	}
}

export function stepFluid(
	grid: FluidGrid,
	seconds: number,
	settings: FluidSettings,
): void {
	const step = Math.min(Math.max(seconds, 0), LONGEST_STEP_SECONDS);
	if (step === 0) return;

	diffuseVelocity(grid, settings);
	project(grid, settings.projectionIterations);
	advectVelocity(grid, step);
	project(grid, settings.projectionIterations);
	advectDensity(grid, step);
	fade(grid.velocityX, settings.velocityFadePerSecond, step);
	fade(grid.velocityY, settings.velocityFadePerSecond, step);
	fade(grid.density, settings.densityFadePerSecond, step);
}

export function isSettled(grid: FluidGrid, faintestInk: number): boolean {
	return grid.density.every((ink) => ink < faintestInk);
}

export function densityAt(
	grid: FluidGrid,
	column: number,
	row: number,
): number {
	return sample(grid, grid.density, column, row);
}

function diffuseVelocity(grid: FluidGrid, settings: FluidSettings): void {
	const rate = settings.diffusion;
	grid.previousX.set(grid.velocityX);
	grid.previousY.set(grid.velocityY);
	relax(
		grid,
		grid.velocityX,
		grid.previousX,
		rate,
		settings.diffusionIterations,
	);
	relax(
		grid,
		grid.velocityY,
		grid.previousY,
		rate,
		settings.diffusionIterations,
	);
}

function advectVelocity(grid: FluidGrid, step: number): void {
	grid.previousX.set(grid.velocityX);
	grid.previousY.set(grid.velocityY);
	advect(grid, grid.velocityX, grid.previousX, step);
	advect(grid, grid.velocityY, grid.previousY, step);
}

function advectDensity(grid: FluidGrid, step: number): void {
	grid.previousDensity.set(grid.density);
	advect(grid, grid.density, grid.previousDensity, step);
}

function relax(
	grid: FluidGrid,
	field: Float32Array,
	source: Float32Array,
	rate: number,
	iterations: number,
): void {
	const share = 1 / (1 + 4 * rate);
	for (let pass = 0; pass < iterations; pass += 1) {
		forEachCell(grid, (column, row, cell) => {
			const around = neighbourSum(grid, field, column, row);
			field[cell] = (at(source, cell) + rate * around) * share;
		});
	}
}

function advect(
	grid: FluidGrid,
	field: Float32Array,
	source: Float32Array,
	step: number,
): void {
	forEachCell(grid, (column, row, cell) => {
		const fromColumn = column - at(grid.previousX, cell) * step;
		const fromRow = row - at(grid.previousY, cell) * step;
		field[cell] = sample(grid, source, fromColumn, fromRow);
	});
}

function project(grid: FluidGrid, iterations: number): void {
	const { velocityX, velocityY, pressure, divergence } = grid;
	forEachCell(grid, (column, row, cell) => {
		divergence[cell] =
			-0.5 *
			(horizontalSpread(grid, velocityX, column, row) +
				verticalSpread(grid, velocityY, column, row));
	});
	pressure.fill(0);
	for (let pass = 0; pass < iterations; pass += 1) {
		forEachCell(grid, (column, row, cell) => {
			pressure[cell] =
				(at(divergence, cell) + neighbourSum(grid, pressure, column, row)) / 4;
		});
	}
	forEachCell(grid, (column, row, cell) => {
		velocityX[cell] =
			at(velocityX, cell) - 0.5 * horizontalSpread(grid, pressure, column, row);
		velocityY[cell] =
			at(velocityY, cell) - 0.5 * verticalSpread(grid, pressure, column, row);
	});
}

function fade(field: Float32Array, perSecond: number, step: number): void {
	const keep = Math.exp(-perSecond * step);
	for (let cell = 0; cell < field.length; cell += 1) {
		field[cell] = at(field, cell) * keep;
	}
}

function sample(
	grid: FluidGrid,
	field: Float32Array,
	column: number,
	row: number,
): number {
	const x = Math.min(Math.max(column, 0), grid.columns - 1);
	const y = Math.min(Math.max(row, 0), grid.rows - 1);
	const left = Math.floor(x);
	const up = Math.floor(y);
	const right = clampColumn(grid, left + 1);
	const down = clampRow(grid, up + 1);
	const across = x - left;
	const along = y - up;
	const upper = lerp(
		at(field, cellIndex(grid, left, up)),
		at(field, cellIndex(grid, right, up)),
		across,
	);
	const lower = lerp(
		at(field, cellIndex(grid, left, down)),
		at(field, cellIndex(grid, right, down)),
		across,
	);
	return lerp(upper, lower, along);
}

function neighbourSum(
	grid: FluidGrid,
	field: Float32Array,
	column: number,
	row: number,
): number {
	return (
		at(field, cellIndex(grid, clampColumn(grid, column - 1), row)) +
		at(field, cellIndex(grid, clampColumn(grid, column + 1), row)) +
		at(field, cellIndex(grid, column, clampRow(grid, row - 1))) +
		at(field, cellIndex(grid, column, clampRow(grid, row + 1)))
	);
}

function horizontalSpread(
	grid: FluidGrid,
	field: Float32Array,
	column: number,
	row: number,
): number {
	return (
		at(field, cellIndex(grid, clampColumn(grid, column + 1), row)) -
		at(field, cellIndex(grid, clampColumn(grid, column - 1), row))
	);
}

function verticalSpread(
	grid: FluidGrid,
	field: Float32Array,
	column: number,
	row: number,
): number {
	return (
		at(field, cellIndex(grid, column, clampRow(grid, row + 1))) -
		at(field, cellIndex(grid, column, clampRow(grid, row - 1)))
	);
}

function forEachCell(
	grid: FluidGrid,
	visit: (column: number, row: number, cell: number) => void,
): void {
	for (let row = 0; row < grid.rows; row += 1) {
		for (let column = 0; column < grid.columns; column += 1) {
			visit(column, row, cellIndex(grid, column, row));
		}
	}
}

function smoothFalloff(distance: number): number {
	const t = Math.min(Math.max(1 - distance, 0), 1);
	return t * t * (3 - 2 * t);
}

function cellIndex(grid: FluidGrid, column: number, row: number): number {
	return row * grid.columns + column;
}

function clampColumn(grid: FluidGrid, column: number): number {
	return Math.min(Math.max(column, 0), grid.columns - 1);
}

function clampRow(grid: FluidGrid, row: number): number {
	return Math.min(Math.max(row, 0), grid.rows - 1);
}

function lerp(from: number, to: number, amount: number): number {
	return from + (to - from) * amount;
}

function at(field: Float32Array, cell: number): number {
	return field[cell] ?? 0;
}
