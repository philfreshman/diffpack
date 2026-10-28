import { describe, expect, test } from "bun:test";
import { TREE_WIDTH } from "#/lib/storage/settings.ts";
import { dragFrame, edgeAfterDrag, nudgedWidth } from "#/lib/tree/gesture.ts";

describe("dragFrame", () => {
	test("within limits the panel is simply that wide, and untouched", () => {
		expect(dragFrame(300)).toEqual({
			width: 300,
			opacity: 1,
			blur: 0,
			collapses: false,
		});
	});

	test("never wider than the maximum", () => {
		expect(dragFrame(TREE_WIDTH.max + 200).width).toBe(TREE_WIDTH.max);
	});

	test("past the minimum it fades and blurs the further it goes", () => {
		const near = dragFrame(TREE_WIDTH.min - 20);
		const far = dragFrame(TREE_WIDTH.min - 120);

		expect(near.width).toBe(TREE_WIDTH.min - 20);
		expect(near.opacity).toBeLessThan(1);
		expect(far.opacity).toBeLessThan(near.opacity);
		expect(far.blur).toBeGreaterThan(near.blur);
	});

	test("at the window's edge it is gone, and fully blurred", () => {
		expect(dragFrame(-50)).toEqual({
			width: 0,
			opacity: 0,
			blur: 2,
			collapses: true,
		});
	});

	test("let go anywhere past the minimum it snaps shut, and at it does not", () => {
		expect(dragFrame(TREE_WIDTH.min).collapses).toBe(false);
		expect(dragFrame(TREE_WIDTH.min - 1).collapses).toBe(true);
	});
});

describe("edgeAfterDrag", () => {
	test("on the left, the panel widens as the edge is pulled right", () => {
		expect(
			edgeAfterDrag({ startWidth: 300, travel: 120, position: "left" }),
		).toBe(420);
		expect(
			edgeAfterDrag({ startWidth: 300, travel: -100, position: "left" }),
		).toBe(200);
	});

	test("on the right, the panel widens as the edge is pulled left", () => {
		expect(
			edgeAfterDrag({ startWidth: 300, travel: -120, position: "right" }),
		).toBe(420);
		expect(
			edgeAfterDrag({ startWidth: 300, travel: 100, position: "right" }),
		).toBe(200);
	});
});

describe("nudgedWidth", () => {
	test("on the left, the right arrow widens and the left arrow narrows", () => {
		expect(nudgedWidth(320, "ArrowRight", "left")).toBe(336);
		expect(nudgedWidth(320, "ArrowLeft", "left")).toBe(304);
	});

	test("on the right, the left arrow widens and the right arrow narrows", () => {
		expect(nudgedWidth(320, "ArrowLeft", "right")).toBe(336);
		expect(nudgedWidth(320, "ArrowRight", "right")).toBe(304);
	});

	test("any other key leaves the width alone", () => {
		expect(nudgedWidth(320, "ArrowUp", "left")).toBeNull();
		expect(nudgedWidth(320, "Enter", "right")).toBeNull();
	});
});
