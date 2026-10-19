import { describe, expect, test } from "bun:test";
import { createEngineReady } from "#/lib/worker/engineReady.ts";

describe("engineReady", () => {
	test("points the engine at the proxy once it has started, and starts it once", async () => {
		const steps: string[] = [];
		const engineReady = createEngineReady(
			async () => {
				steps.push("start");
			},
			() => {
				steps.push("proxy");
			},
		);

		await Promise.all([engineReady(), engineReady()]);

		expect(steps).toEqual(["start", "proxy"]);
	});

	test("stays ready for every other registry when the proxy origin is refused", async () => {
		const engineReady = createEngineReady(
			async () => {},
			() => {
				throw new Error("Invalid proxy origin");
			},
		);

		expect(await engineReady()).toBeUndefined();
	});

	test("tries to start again after a failed start, rather than failing every later message", async () => {
		let starts = 0;
		const engineReady = createEngineReady(
			async () => {
				starts += 1;
				if (starts === 1) throw new Error("wasm failed to load");
			},
			() => {},
		);

		await expect(engineReady()).rejects.toThrow("wasm failed to load");
		expect(await engineReady()).toBeUndefined();
		expect(starts).toBe(2);
	});
});
