import {
	createFluidGrid,
	densityAt,
	type FluidGrid,
	type FluidSettings,
	isSettled,
	stepFluid,
	stirFluid,
} from "#/lib/asciiTrail/fluid.ts";
import {
	BLANK,
	DRAWN_GLYPHS,
	FAINTEST_VISIBLE_INK,
	glyphFor,
} from "#/lib/asciiTrail/glyphs.ts";

const FRAME_INTERVAL_MS = 1000 / 12;
const MAX_PIXEL_RATIO = 2;
const FONT_SIZE_PX = 9;
const CELL_PADDING_X = 1;
const CELL_PADDING_Y = 2;
const FALLBACK_CELL_ASPECT = 5 / 3;
const GLYPH_WIDTH_FILL = 0.92;
const FLUID_RESOLUTION = 1.5;
const HOVER_RADIUS_PX = 28;
const FORCE_SCALE = 0.5;
const INK_STRENGTH = 0.3;
const SHORTEST_GAP_SECONDS = 0.001;
const LONGEST_GAP_SECONDS = 0.5;
const FIRST_GAP_SECONDS = 0.016;
const DRAG_THRESHOLD_PX = 6;
const DRAG_BOOST_SCALE = 0.03;
const DRAG_BOOST_MAX_PX = 60;

const TRAIL_FLUID: FluidSettings = {
	diffusion: 1.5,
	diffusionIterations: 5,
	projectionIterations: 10,
	velocityFadePerSecond: 0.1,
	densityFadePerSecond: 0.5,
};

interface CellLayout {
	width: number;
	height: number;
	font: string;
	baseline: number;
	glyphLeft: ReadonlyMap<string, number>;
}

interface Trail {
	columns: number;
	rows: number;
	widthPx: number;
	heightPx: number;
	fluid: FluidGrid;
}

interface PointerSample {
	x: number;
	y: number;
	time: number;
}

interface PointerMotion {
	deltaX: number;
	deltaY: number;
	seconds: number;
}

interface Press {
	id: number;
	x: number;
	y: number;
	dragged: boolean;
}

interface TrailAnimation {
	wake(): void;
	stop(): void;
}

type Stir = (
	point: PointerSample,
	motion: PointerMotion,
	radiusPx: number,
) => void;

export function startAsciiTrail(canvas: HTMLCanvasElement): () => void {
	const context = canvas.getContext("2d");
	if (!context) return () => {};

	const cell = measureCell(canvas, context);
	let trail = fitCanvas(canvas, context, cell);
	const currentTrail = () => trail;
	const animation = animateTrail(canvas, context, cell, currentTrail);

	const resize = new ResizeObserver(() => {
		trail = fitCanvas(canvas, context, cell);
	});

	resize.observe(canvas);
	const stopFollowing = followPointer(
		canvas,
		currentTrail,
		(point, motion, radiusPx) => {
			stirAt(trail, point, motion, radiusPx);
			animation.wake();
		},
	);

	return () => {
		animation.stop();
		resize.disconnect();
		stopFollowing();
	};
}

function animateTrail(
	canvas: HTMLCanvasElement,
	context: CanvasRenderingContext2D,
	cell: CellLayout,
	currentTrail: () => Trail,
): TrailAnimation {
	let frame = 0;
	let lastStepAt = 0;

	const tick = (now: number) => {
		frame = 0;
		const trail = currentTrail();
		if (now - lastStepAt >= FRAME_INTERVAL_MS) {
			stepFluid(trail.fluid, (now - lastStepAt) / 1000, TRAIL_FLUID);
			lastStepAt = now;
			drawGlyphs(canvas, context, trail, cell);
		}
		if (!isSettled(trail.fluid, FAINTEST_VISIBLE_INK))
			frame = requestAnimationFrame(tick);
	};

	return {
		wake() {
			if (frame) return;
			lastStepAt = performance.now();
			frame = requestAnimationFrame(tick);
		},
		stop() {
			cancelAnimationFrame(frame);
		},
	};
}

function followPointer(
	canvas: HTMLCanvasElement,
	currentTrail: () => Trail,
	stir: Stir,
): () => void {
	let previous: PointerSample | null = null;
	let press: Press | null = null;

	const onPointerDown = (event: PointerEvent) => {
		const point = pointerPosition(canvas, event);
		if (!event.isPrimary || !isInside(currentTrail(), point)) return;
		press = { id: event.pointerId, x: point.x, y: point.y, dragged: false };
		previous = point;
	};

	const onPointerMove = (event: PointerEvent) => {
		if (!isMouse(event) && press?.id !== event.pointerId) return;
		const point = pointerPosition(canvas, event);
		if (!isInside(currentTrail(), point)) {
			previous = null;
			return;
		}
		const dragging = press?.id === event.pointerId ? press : null;
		if (dragging && !dragging.dragged)
			dragging.dragged = hasLeftPress(dragging, point);
		const motion = motionSince(previous, point, event);
		previous = point;
		if (motion.deltaX === 0 && motion.deltaY === 0) return;
		stir(point, motion, stirRadiusPx(motion, dragging?.dragged));
	};

	const onPointerRelease = (event: PointerEvent) => {
		if (press?.id === event.pointerId) press = null;
	};

	window.addEventListener("pointerdown", onPointerDown, { passive: true });
	window.addEventListener("pointermove", onPointerMove, { passive: true });
	window.addEventListener("pointerup", onPointerRelease, { passive: true });
	window.addEventListener("pointercancel", onPointerRelease, { passive: true });

	return () => {
		window.removeEventListener("pointerdown", onPointerDown);
		window.removeEventListener("pointermove", onPointerMove);
		window.removeEventListener("pointerup", onPointerRelease);
		window.removeEventListener("pointercancel", onPointerRelease);
	};
}

function measureCell(
	canvas: HTMLCanvasElement,
	context: CanvasRenderingContext2D,
): CellLayout {
	const family = getComputedStyle(canvas).fontFamily;
	const glyphHeight = FONT_SIZE_PX;
	const glyphWidth = glyphHeight / cellAspect(context, family);
	const font = fittedFont(context, family, glyphWidth, glyphHeight);
	context.font = font;
	const metrics = DRAWN_GLYPHS.map((glyph) => context.measureText(glyph));
	const deepest = Math.max(...metrics.map(descentOf));
	const glyphLeft = new Map(
		DRAWN_GLYPHS.map((glyph, index) => {
			const ink = metrics[index];
			const left = ink
				? CELL_PADDING_X + (glyphWidth - inkWidthOf(ink)) / 2 + inkLeftOf(ink)
				: CELL_PADDING_X;
			return [glyph, left];
		}),
	);
	return {
		width: glyphWidth + 2 * CELL_PADDING_X,
		height: glyphHeight + 2 * CELL_PADDING_Y,
		font,
		baseline: CELL_PADDING_Y + glyphHeight - deepest,
		glyphLeft,
	};
}

function cellAspect(context: CanvasRenderingContext2D, family: string): number {
	context.font = `100px ${family}`;
	const letter = context.measureText("M");
	const aspect = (ascentOf(letter) + descentOf(letter)) / letter.width;
	return Number.isFinite(aspect) && aspect > 0 ? aspect : FALLBACK_CELL_ASPECT;
}

function fittedFont(
	context: CanvasRenderingContext2D,
	family: string,
	width: number,
	height: number,
): string {
	context.font = `${height}px ${family}`;
	const metrics = DRAWN_GLYPHS.map((glyph) => context.measureText(glyph));
	const widest = Math.max(...metrics.map(inkWidthOf));
	const tallest =
		Math.max(...metrics.map(ascentOf)) + Math.max(...metrics.map(descentOf));
	const scale = Math.min((GLYPH_WIDTH_FILL * width) / widest, height / tallest);
	const size = Number.isFinite(scale) && scale > 0 ? height * scale : height;
	return `${size}px ${family}`;
}

function fitCanvas(
	canvas: HTMLCanvasElement,
	context: CanvasRenderingContext2D,
	cell: CellLayout,
): Trail {
	const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
	const { clientWidth, clientHeight } = canvas;
	canvas.width = Math.round(clientWidth * ratio);
	canvas.height = Math.round(clientHeight * ratio);
	context.setTransform(ratio, 0, 0, ratio, 0, 0);
	context.font = cell.font;
	context.textAlign = "left";
	context.textBaseline = "alphabetic";
	const columns = Math.max(1, Math.floor(clientWidth / cell.width));
	const rows = Math.max(1, Math.floor(clientHeight / cell.height));
	return {
		columns,
		rows,
		widthPx: clientWidth,
		heightPx: clientHeight,
		fluid: createFluidGrid(
			Math.max(1, Math.round(columns * FLUID_RESOLUTION)),
			Math.max(1, Math.round(rows * FLUID_RESOLUTION)),
		),
	};
}

function drawGlyphs(
	canvas: HTMLCanvasElement,
	context: CanvasRenderingContext2D,
	trail: Trail,
	cell: CellLayout,
): void {
	context.clearRect(0, 0, trail.widthPx, trail.heightPx);
	context.fillStyle = getComputedStyle(canvas).color;
	const fluidPerColumn = spread(trail.fluid.columns, trail.columns);
	const fluidPerRow = spread(trail.fluid.rows, trail.rows);
	for (let row = 0; row < trail.rows; row += 1) {
		for (let column = 0; column < trail.columns; column += 1) {
			const ink = densityAt(
				trail.fluid,
				column * fluidPerColumn,
				row * fluidPerRow,
			);
			const glyph = glyphFor(ink);
			if (glyph === BLANK) continue;
			context.fillText(
				glyph,
				column * cell.width + (cell.glyphLeft.get(glyph) ?? 0),
				row * cell.height + cell.baseline,
			);
		}
	}
}

function stirAt(
	trail: Trail,
	point: PointerSample,
	motion: PointerMotion,
	radiusPx: number,
) {
	const { fluid } = trail;
	const cellsPerPxX = fluid.columns / trail.widthPx;
	const cellsPerPxY = fluid.rows / trail.heightPx;
	stirFluid(fluid, {
		column: (point.x / trail.widthPx) * (fluid.columns - 1),
		row: (point.y / trail.heightPx) * (fluid.rows - 1),
		radius: radiusPx * Math.min(cellsPerPxX, cellsPerPxY),
		pushX: (motion.deltaX / motion.seconds) * cellsPerPxX * FORCE_SCALE,
		pushY: (motion.deltaY / motion.seconds) * cellsPerPxY * FORCE_SCALE,
		ink: INK_STRENGTH,
	});
}

function stirRadiusPx(motion: PointerMotion, dragged = false): number {
	if (!dragged) return HOVER_RADIUS_PX;
	const speed = Math.hypot(motion.deltaX, motion.deltaY) / motion.seconds;
	return (
		HOVER_RADIUS_PX + Math.min(DRAG_BOOST_MAX_PX, speed * DRAG_BOOST_SCALE)
	);
}

function hasLeftPress(press: Press, point: PointerSample): boolean {
	return Math.hypot(point.x - press.x, point.y - press.y) >= DRAG_THRESHOLD_PX;
}

function isMouse(event: PointerEvent): boolean {
	return !event.pointerType || event.pointerType === "mouse";
}

function motionSince(
	previous: PointerSample | null,
	point: PointerSample,
	event: PointerEvent,
): PointerMotion {
	if (!previous) {
		return {
			deltaX: event.movementX,
			deltaY: event.movementY,
			seconds: FIRST_GAP_SECONDS,
		};
	}
	const seconds = (point.time - previous.time) / 1000;
	return {
		deltaX: point.x - previous.x,
		deltaY: point.y - previous.y,
		seconds: Math.min(
			Math.max(seconds, SHORTEST_GAP_SECONDS),
			LONGEST_GAP_SECONDS,
		),
	};
}

function pointerPosition(
	canvas: HTMLCanvasElement,
	event: PointerEvent,
): PointerSample {
	const bounds = canvas.getBoundingClientRect();
	return {
		x: event.clientX - bounds.left,
		y: event.clientY - bounds.top,
		time: event.timeStamp,
	};
}

function isInside(trail: Trail, point: PointerSample): boolean {
	return (
		point.x >= 0 &&
		point.y >= 0 &&
		point.x <= trail.widthPx &&
		point.y <= trail.heightPx
	);
}

function spread(fluidCells: number, characterCells: number): number {
	return characterCells > 1 ? (fluidCells - 1) / (characterCells - 1) : 0;
}

function inkWidthOf(metrics: TextMetrics): number {
	const width = inkLeftOf(metrics) + (metrics.actualBoundingBoxRight || 0);
	return width || metrics.width;
}

function inkLeftOf(metrics: TextMetrics): number {
	return metrics.actualBoundingBoxLeft || 0;
}

function ascentOf(metrics: TextMetrics): number {
	return metrics.actualBoundingBoxAscent || 0;
}

function descentOf(metrics: TextMetrics): number {
	return metrics.actualBoundingBoxDescent || 0;
}
