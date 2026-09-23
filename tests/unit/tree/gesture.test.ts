import { describe, expect, test } from "bun:test";
import { TREE_WIDTH } from "#/lib/storage/settings.ts";
import { dragFrame } from "#/lib/tree/gesture.ts";

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
