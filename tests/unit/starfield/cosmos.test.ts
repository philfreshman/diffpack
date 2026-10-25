import { describe, expect, test } from "bun:test";
import { BLUE, COSMOS_GLSL, hueAt, PURPLE } from "#/lib/starfield/cosmos.ts";

const FULL_SWING = (30 * Math.PI) / 180;

type Channels = [number, number, number];

function toBytes(colour: Channels): Channels {
	return colour.map((channel) => Math.round(channel * 255)) as Channels;
}

async function cssBackdropColourAt(position: string): Promise<Channels> {
	const css = await Bun.file("src/styles/globals.css").text();
	const pattern = new RegExp(
		`ellipse at ${position},\\s*rgb\\((\\d+) (\\d+) (\\d+)`,
	);
	const channels = css.match(pattern)?.slice(1).map(Number);
	if (channels?.length !== 3) throw new Error(`no gradient at ${position}`);

	return channels as Channels;
}

describe("the WebGL backdrop matches --cosmic-backdrop", () => {
	test("purple sits where the stylesheet puts it", async () => {
		expect(toBytes(PURPLE)).toEqual(await cssBackdropColourAt("20% 30%"));
	});

	test("blue sits where the stylesheet puts it", async () => {
		expect(toBytes(BLUE)).toEqual(await cssBackdropColourAt("80% 70%"));
	});

	test("the shader is built from the same two colours", () => {
		expect(COSMOS_GLSL).toContain(`vec3(${PURPLE.join(", ")})`);
		expect(COSMOS_GLSL).toContain(`vec3(${BLUE.join(", ")})`);
	});
});

describe("hueAt", () => {
	test("starts unshifted", () => {
		expect(hueAt(0)).toBe(0);
	});

	test("reaches the full swing at the 20 s turn of the CSS animation", () => {
		expect(hueAt(20)).toBeCloseTo(FULL_SWING);
	});

	test("is back where it started after the 40 s round trip", () => {
		expect(hueAt(40)).toBeCloseTo(0);
		expect(hueAt(53)).toBeCloseTo(hueAt(13));
	});

	test("never leaves the swing", () => {
		for (let seconds = 0; seconds < 40; seconds += 0.5) {
			expect(hueAt(seconds)).toBeGreaterThanOrEqual(0);
			expect(hueAt(seconds)).toBeLessThanOrEqual(FULL_SWING + 1e-12);
		}
	});
});
