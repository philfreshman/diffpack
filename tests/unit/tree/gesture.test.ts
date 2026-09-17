import { describe, expect, test } from "bun:test";
import { dragFrame } from "#/lib/tree/gesture.ts";
import { MAX_TREE_WIDTH, MIN_TREE_WIDTH } from "#/lib/tree/prefs.ts";

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
		expect(dragFrame(MAX_TREE_WIDTH + 200).width).toBe(MAX_TREE_WIDTH);
	});

	test("past the minimum it fades and blurs the further it goes", () => {
		const near = dragFrame(MIN_TREE_WIDTH - 20);
		const far = dragFrame(MIN_TREE_WIDTH - 120);

		expect(near.width).toBe(MIN_TREE_WIDTH - 20);
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
		expect(dragFrame(MIN_TREE_WIDTH).collapses).toBe(false);
		expect(dragFrame(MIN_TREE_WIDTH - 1).collapses).toBe(true);
	});
});
