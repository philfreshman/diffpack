import { describe, expect, test } from "bun:test";
import {
	TREE_COLLAPSED,
	TREE_POSITION,
	TREE_WIDTH,
} from "#/lib/storage/settings.ts";
import type { SettingStore } from "#/lib/storage/storedSetting.ts";
import { dragFrame } from "#/lib/tree/gesture.ts";
import { sidebar as appSidebar, createSidebar } from "#/lib/tree/sidebar.ts";
import { TREE_WIDTH_SCRIPT } from "#/lib/tree/widthScript.ts";
import { memoryStore, REFUSING_STORE } from "../storage/storeStub.ts";

function fakeDocument(): Document {
	const attributes = new Map<string, string>();
	const properties = new Map<string, string>();
	const documentElement = {
		hasAttribute: (name: string) => attributes.has(name),
		getAttribute: (name: string) => attributes.get(name) ?? null,
		setAttribute(name: string, value: string) {
			attributes.set(name, value);
		},
		removeAttribute(name: string) {
			attributes.delete(name);
		},
		toggleAttribute(name: string, force: boolean) {
			if (force) attributes.set(name, "");
			else attributes.delete(name);

			return force;
		},
		style: {
			setProperty(name: string, value: string) {
				properties.set(name, value);
			},
			getPropertyValue: (name: string) => properties.get(name) ?? "",
		},
	};

	return { documentElement } as unknown as Document;
}

function fakeClock() {
	const waiting: Array<{ ms: number; fire: () => void }> = [];

	return {
		waiting,
		after(ms: number, fire: () => void) {
			waiting.push({ ms, fire });
		},
		elapse() {
			for (const { fire } of waiting.splice(0)) fire();
		},
		elapseFirst() {
			waiting.shift()?.fire();
		},
	};
}

function page(store: SettingStore = memoryStore()) {
	const document = fakeDocument();
	const clock = fakeClock();
	const sidebar = createSidebar({ document, store, after: clock.after });
	const html = document.documentElement;

	return {
		sidebar,
		store,
		clock,
		// Spelled out: the stylesheets select on these names and do not import the module's constants.
		shut: () => html.hasAttribute("data-tree-collapsed"),
		dragging: () => html.hasAttribute("data-tree-dragging"),
		snapping: () => html.hasAttribute("data-tree-snapping"),
		shownWidth: () => html.style.getPropertyValue("--tree-panel-width"),
		side: () => html.getAttribute("data-tree-position"),
		// What the pre-paint script does for a visitor who left it shut.
		loadShut: () => html.toggleAttribute("data-tree-collapsed", true),
		runPrePaintScript: () =>
			new Function("document", "localStorage", TREE_WIDTH_SCRIPT)(
				document,
				store,
			),
	};
}

describe("opening and closing", () => {
	test("close shuts the panel, and it stays shut for the next visit", () => {
		const { sidebar, store, shut } = page();

		sidebar.close();

		expect(shut()).toBe(true);
		expect(store.getItem(TREE_COLLAPSED.key)).toBe("true");
	});

	test("open shows a shut panel, and it stays open for the next visit", () => {
		const { sidebar, store, shut, loadShut } = page();
		loadShut();

		sidebar.open();

		expect(shut()).toBe(false);
		expect(store.getItem(TREE_COLLAPSED.key)).toBe("false");
	});

	test("asked for what it already is, it changes and stores nothing", () => {
		const { sidebar, store, shut } = page();

		sidebar.open();

		expect(shut()).toBe(false);
		expect(store.getItem(TREE_COLLAPSED.key)).toBeNull();
	});

	test("a store that refuses still opens and shuts it for the session", () => {
		const { sidebar, shut } = page(REFUSING_STORE);

		sidebar.close();
		expect(shut()).toBe(true);

		sidebar.open();
		expect(shut()).toBe(false);
	});
});

describe("resizing", () => {
	test("sets the width on the page, and keeps it for the next visit", () => {
		const { sidebar, store, shownWidth } = page();

		sidebar.resize(420);

		expect(shownWidth()).toBe("420px");
		expect(sidebar.width()).toBe(420);
		expect(store.getItem(TREE_WIDTH.key)).toBe("420");
	});

	test("never beyond the panel's bounds", () => {
		const { sidebar, store, shownWidth } = page();

		sidebar.resize(TREE_WIDTH.max + 500);
		expect(shownWidth()).toBe(`${TREE_WIDTH.max}px`);
		expect(store.getItem(TREE_WIDTH.key)).toBe(String(TREE_WIDTH.max));

		sidebar.resize(10);
		expect(shownWidth()).toBe(`${TREE_WIDTH.min}px`);
		expect(sidebar.width()).toBe(TREE_WIDTH.min);
	});

	test("to a whole pixel, which is what is stored", () => {
		// Under browser zoom the edge is let go between two pixels.
		const { sidebar, store, shownWidth } = page();

		sidebar.resize(420.6);

		expect(shownWidth()).toBe("421px");
		expect(sidebar.width()).toBe(421);
		expect(store.getItem(TREE_WIDTH.key)).toBe("421");
	});

	test("starts from the width stored on an earlier visit", () => {
		const store = memoryStore();
		store.setItem(TREE_WIDTH.key, "440");

		expect(page(store).sidebar.width()).toBe(440);
	});

	test("starts from the default with nothing stored, or a store that refuses", () => {
		expect(page().sidebar.width()).toBe(TREE_WIDTH.fallback);
		expect(page(REFUSING_STORE).sidebar.width()).toBe(TREE_WIDTH.fallback);
	});

	test("a store that refuses still resizes it for the session", () => {
		const { sidebar, shownWidth } = page(REFUSING_STORE);

		sidebar.resize(420);

		expect(shownWidth()).toBe("420px");
		expect(sidebar.width()).toBe(420);
	});

	test("tells whoever is listening, until they stop", () => {
		const { sidebar } = page();
		const heard: number[] = [];
		const stop = sidebar.subscribe(() => heard.push(sidebar.width()));

		sidebar.resize(400);
		stop();
		sidebar.resize(500);

		expect(heard).toEqual([400]);
	});
});

describe("dragging the edge", () => {
	test("marks the page for as long as the edge is held", () => {
		const { sidebar, dragging } = page();

		sidebar.startDrag();
		expect(dragging()).toBe(true);

		sidebar.endDrag(300);
		expect(dragging()).toBe(false);
	});

	test("the box follows the edge, but no width is chosen until it is let go", () => {
		const { sidebar, store, shownWidth } = page();
		sidebar.startDrag();

		expect(sidebar.dragTo(500)).toEqual(dragFrame(500));
		expect(shownWidth()).toBe("500px");
		expect(sidebar.width()).toBe(TREE_WIDTH.fallback);
		expect(store.getItem(TREE_WIDTH.key)).toBeNull();

		sidebar.endDrag(500);
		expect(sidebar.width()).toBe(500);
		expect(store.getItem(TREE_WIDTH.key)).toBe("500");
	});

	test("past the minimum the box keeps following, and says how far it has faded", () => {
		const { sidebar, shownWidth } = page();
		sidebar.startDrag();

		const frame = sidebar.dragTo(TREE_WIDTH.min - 60);

		expect(frame).toEqual(dragFrame(TREE_WIDTH.min - 60));
		expect(frame.opacity).toBeLessThan(1);
		expect(shownWidth()).toBe(`${TREE_WIDTH.min - 60}px`);
	});
});

describe("snapping shut", () => {
	function letGoPastTheMinimum() {
		const it = page();
		it.sidebar.resize(400);
		it.sidebar.startDrag();
		it.sidebar.dragTo(100);
		it.sidebar.endDrag(100);

		return it;
	}

	test("let go past the minimum, it animates out before it shuts", () => {
		const { snapping, shut } = letGoPastTheMinimum();

		expect(snapping()).toBe(true);
		expect(shut()).toBe(false);
	});

	test("then shuts, at the width it had before the drag", () => {
		const { sidebar, store, clock, snapping, shut, shownWidth } =
			letGoPastTheMinimum();

		clock.elapse();

		expect(shut()).toBe(true);
		expect(snapping()).toBe(false);
		expect(shownWidth()).toBe("400px");
		expect(sidebar.width()).toBe(400);
		expect(store.getItem(TREE_WIDTH.key)).toBe("400");
		expect(store.getItem(TREE_COLLAPSED.key)).toBe("true");
	});

	test("opened while it is snapping, the snap is taken back", () => {
		const { sidebar, store, clock, snapping, shut, shownWidth } =
			letGoPastTheMinimum();

		sidebar.open();
		clock.elapse();

		expect(shut()).toBe(false);
		expect(snapping()).toBe(false);
		expect(shownWidth()).toBe("400px");
		expect(store.getItem(TREE_COLLAPSED.key)).toBeNull();
	});

	test("a snap taken back does not cut short the next one", () => {
		// The first snap's wait runs out while the second is still animating.
		const { sidebar, clock, snapping, shut } = letGoPastTheMinimum();
		sidebar.open();
		sidebar.startDrag();
		sidebar.dragTo(100);
		sidebar.endDrag(100);

		clock.elapseFirst();
		expect(shut()).toBe(false);
		expect(snapping()).toBe(true);

		clock.elapse();
		expect(shut()).toBe(true);
	});

	test("waits exactly as long as the stylesheet takes to animate it", async () => {
		// The wait is `--duration-fast` written again in TypeScript.
		const css = await Bun.file("src/styles/globals.css").text();
		const duration = css.match(/--duration-fast:\s*(\d+)ms;/)?.[1];
		const { clock } = letGoPastTheMinimum();

		expect(duration).toBeDefined();
		expect(clock.waiting.map((it) => it.ms)).toEqual([Number(duration)]);
	});

	test("shut while it is snapping, it shuts there and then", () => {
		const { sidebar, clock, snapping, shut, shownWidth } =
			letGoPastTheMinimum();

		sidebar.close();

		expect(shut()).toBe(true);
		expect(snapping()).toBe(false);
		expect(shownWidth()).toBe("400px");

		clock.elapse();
		expect(shut()).toBe(true);
	});
});

describe("moving it to a side", () => {
	test("to the right marks the page, and it stays there for the next visit", () => {
		const { sidebar, store, side } = page();

		sidebar.place("right");

		expect(side()).toBe("right");
		expect(sidebar.position()).toBe("right");
		expect(store.getItem(TREE_POSITION.key)).toBe("right");
	});

	test("back to the left clears the mark, and stores the choice", () => {
		const { sidebar, store, side } = page();
		sidebar.place("right");

		sidebar.place("left");

		expect(side()).toBeNull();
		expect(sidebar.position()).toBe("left");
		expect(store.getItem(TREE_POSITION.key)).toBe("left");
	});

	test("starts on the side stored on an earlier visit, and on the left otherwise", () => {
		const store = memoryStore();
		store.setItem(TREE_POSITION.key, "right");

		expect(page(store).sidebar.position()).toBe("right");
		expect(page().sidebar.position()).toBe("left");
		expect(page(REFUSING_STORE).sidebar.position()).toBe("left");
	});

	test("a store that refuses still moves it for the session", () => {
		const { sidebar, side } = page(REFUSING_STORE);

		sidebar.place("right");

		expect(side()).toBe("right");
		expect(sidebar.position()).toBe("right");
	});

	test("tells whoever is listening", () => {
		const { sidebar } = page();
		const heard: string[] = [];
		sidebar.subscribe(() => heard.push(sidebar.position()));

		sidebar.place("right");

		expect(heard).toEqual(["right"]);
	});
});

describe("before the first paint", () => {
	test("a visitor who chose the right finds the page marked for it", () => {
		const store = memoryStore();
		store.setItem(TREE_POSITION.key, "right");
		const { side, runPrePaintScript } = page(store);

		runPrePaintScript();

		expect(side()).toBe("right");
	});

	test("the side chosen in one visit is the one marked in the next", () => {
		const store = memoryStore();
		page(store).sidebar.place("right");
		const next = page(store);

		next.runPrePaintScript();

		expect(next.side()).toBe("right");
	});

	test.each([
		["nothing is stored", memoryStore()],
		["the left is stored", storing(TREE_POSITION.key, "left")],
		["the store refuses", REFUSING_STORE],
	])("nothing is marked when %s", (_, store) => {
		const { side, shownWidth, runPrePaintScript } = page(store);

		runPrePaintScript();

		expect(side()).toBeNull();
		expect(shownWidth()).toBe("320px");
	});
});

function storing(key: string, value: string): SettingStore {
	const store = memoryStore();
	store.setItem(key, value);

	return store;
}

describe("the app's sidebar", () => {
	test("is created with no document and no storage, so the server can import it", () => {
		expect(typeof document).toBe("undefined");
		expect(appSidebar.width()).toBe(TREE_WIDTH.fallback);
	});
});
