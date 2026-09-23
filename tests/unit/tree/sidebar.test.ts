import { describe, expect, test } from "bun:test";
import { TREE_COLLAPSED, TREE_WIDTH } from "#/lib/storage/settings.ts";
import type { SettingStore } from "#/lib/storage/storedSetting.ts";
import { dragFrame } from "#/lib/tree/gesture.ts";
import { createSidebar } from "#/lib/tree/sidebar.ts";
import { memoryStore, REFUSING_STORE } from "../storage/storeStub.ts";

/**
 * `<html>` as far as the sidebar touches it: its attributes, and the custom
 * properties on its inline style.
 */
function fakeDocument(): Document {
	const attributes = new Set<string>();
	const properties = new Map<string, string>();
	const documentElement = {
		hasAttribute: (name: string) => attributes.has(name),
		toggleAttribute(name: string, force: boolean) {
			if (force) attributes.add(name);
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

/** A clock whose time comes only when the test says so. */
function fakeClock() {
	const waiting: Array<{ ms: number; then: () => void }> = [];

	return {
		waiting,
		after(ms: number, then: () => void) {
			waiting.push({ ms, then });
		},
		/** Everything waiting has waited long enough. */
		elapse() {
			for (const { then } of waiting.splice(0)) then();
		},
		/** Only the first thing waiting has waited long enough. */
		elapseFirst() {
			waiting.shift()?.then();
		},
	};
}

/** A sidebar on a page of its own, kept in `store`. */
function page(store: SettingStore = memoryStore()) {
	const document = fakeDocument();
	const clock = fakeClock();
	const sidebar = createSidebar({ document, store, after: clock.after });
	const html = document.documentElement;

	return {
		sidebar,
		store,
		clock,
		// The names the stylesheets select on, spelled out: they are the other
		// half of the contract, and do not import the module's constants.
		shut: () => html.hasAttribute("data-tree-collapsed"),
		dragging: () => html.hasAttribute("data-tree-dragging"),
		snapping: () => html.hasAttribute("data-tree-snapping"),
		shownWidth: () => html.style.getPropertyValue("--tree-panel-width"),
		/** What the pre-paint script does for a visitor who left it shut. */
		loadShut: () => html.toggleAttribute("data-tree-collapsed", true),
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
		// The F shortcut opens the panel whether or not it is shut.
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
	/** A panel chosen at 400px, dragged down past its minimum and let go. */
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
		// Reopening gives back the panel that was there, not the sliver it was
		// dragged down to — and the sliver was never a width anyone chose.
		expect(shownWidth()).toBe("400px");
		expect(sidebar.width()).toBe(400);
		expect(store.getItem(TREE_WIDTH.key)).toBe("400");
		expect(store.getItem(TREE_COLLAPSED.key)).toBe("true");
	});

	test("opened while it is snapping, the snap is taken back", () => {
		// The header's way back in shows the moment the snap starts.
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
		// Opened mid-snap and dragged shut again at once: the first snap's
		// wait runs out while the second is still animating.
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
		// The wait is `--duration-fast` written again in TypeScript. Shorter,
		// and the panel vanishes mid-animation; longer, and it sits at nothing
		// before it is marked shut.
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
