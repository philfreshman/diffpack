import {
	TREE_COLLAPSED,
	TREE_POSITION,
	TREE_WIDTH,
} from "#/lib/storage/settings.ts";
import {
	readSetting,
	type SettingStore,
	writeSetting,
} from "#/lib/storage/storedSetting.ts";
import { type DragFrame, dragFrame } from "./gesture.ts";
import type { TreePosition } from "./position.ts";

export const WIDTH_PROPERTY = "--tree-panel-width";

export const COLLAPSED_ATTRIBUTE = "data-tree-collapsed";

export const POSITION_ATTRIBUTE = "data-tree-position";

const DRAGGING_ATTRIBUTE = "data-tree-dragging";

const SNAPPING_ATTRIBUTE = "data-tree-snapping";

/** Must equal `--duration-fast` in globals.css; a unit test checks. */
const SNAP_MS = 150;

type After = (ms: number, then: () => void) => void;

interface SidebarOptions {
	document?: Document;
	store?: SettingStore;
	after?: After;
}

function createPanelView(page: Document | undefined) {
	// Looked up per action: there is no document on the server.
	const root = () => (page ?? document).documentElement;

	return {
		mark(attribute: string, on: boolean): void {
			root().toggleAttribute(attribute, on);
		},

		showWidth(width: number): void {
			root().style.setProperty(WIDTH_PROPERTY, `${width}px`);
		},

		showPosition(next: TreePosition): void {
			if (next === TREE_POSITION.fallback)
				root().removeAttribute(POSITION_ATTRIBUTE);
			else root().setAttribute(POSITION_ATTRIBUTE, next);
		},

		collapsed(): boolean {
			return root().hasAttribute(COLLAPSED_ATTRIBUTE);
		},
	};
}

type PanelView = ReturnType<typeof createPanelView>;

function createListeners() {
	const listeners = new Set<() => void>();

	return {
		notify(): void {
			for (const listener of listeners) listener();
		},

		subscribe(listener: () => void): () => void {
			listeners.add(listener);

			return () => listeners.delete(listener);
		},
	};
}

function createWidthChoice(
	view: PanelView,
	store: SettingStore | undefined,
	notify: () => void,
) {
	let chosen: number | undefined;

	return {
		width(): number {
			chosen ??= readSetting(TREE_WIDTH, store);

			return chosen;
		},

		// Rounded: under browser zoom a drag can end between two pixels.
		resize(next: number): void {
			chosen = TREE_WIDTH.clamp(Math.round(next));
			view.showWidth(chosen);
			writeSetting(TREE_WIDTH, chosen, store);
			notify();
		},
	};
}

function createPositionChoice(
	view: PanelView,
	store: SettingStore | undefined,
	notify: () => void,
) {
	let placed: TreePosition | undefined;

	return {
		position(): TreePosition {
			placed ??= readSetting(TREE_POSITION, store);

			return placed;
		},

		place(next: TreePosition): void {
			placed = next;
			view.showPosition(next);
			writeSetting(TREE_POSITION, next, store);
			notify();
		},
	};
}

function createSnap(view: PanelView, after: After, chosenWidth: () => number) {
	// A fresh object per snap, so the timer of a settled snap knows it is stale.
	let snap: object | null = null;

	return {
		start(close: () => void): void {
			const current = {};
			snap = current;
			view.mark(SNAPPING_ATTRIBUTE, true);
			after(SNAP_MS, () => {
				if (snap === current) close();
			});
		},

		// Back to the chosen width, not the sliver the drag left.
		settle(): void {
			if (!snap) return;
			snap = null;
			view.showWidth(chosenWidth());
			view.mark(SNAPPING_ATTRIBUTE, false);
		},
	};
}

type Snap = ReturnType<typeof createSnap>;

function createDrag(
	view: PanelView,
	snap: Snap,
	resize: (width: number) => void,
	close: () => void,
) {
	return {
		startDrag(): void {
			view.mark(DRAGGING_ATTRIBUTE, true);
		},

		dragTo(edge: number): DragFrame {
			const frame = dragFrame(edge);
			view.showWidth(frame.width);

			return frame;
		},

		endDrag(edge: number): void {
			view.mark(DRAGGING_ATTRIBUTE, false);
			if (dragFrame(edge).collapses) snap.start(close);
			else resize(edge);
		},
	};
}

export function createSidebar({
	document: page,
	store,
	after = (ms, then) => setTimeout(then, ms),
}: SidebarOptions = {}) {
	const view = createPanelView(page);
	const listeners = createListeners();
	const widthChoice = createWidthChoice(view, store, listeners.notify);
	const positionChoice = createPositionChoice(view, store, listeners.notify);
	const snap = createSnap(view, after, widthChoice.width);

	// Settles a snap first: the panel can be reopened the moment a snap starts.
	function setShut(shut: boolean): void {
		snap.settle();
		if (view.collapsed() === shut) return;
		view.mark(COLLAPSED_ATTRIBUTE, shut);
		writeSetting(TREE_COLLAPSED, shut, store);
		listeners.notify();
	}

	function open(): void {
		setShut(false);
	}

	function close(): void {
		setShut(true);
	}

	function toggle(): void {
		setShut(!view.collapsed());
	}

	const drag = createDrag(view, snap, widthChoice.resize, close);

	return {
		open,
		close,
		toggle,
		collapsed: view.collapsed,
		resize: widthChoice.resize,
		width: widthChoice.width,
		place: positionChoice.place,
		position: positionChoice.position,
		subscribe: listeners.subscribe,
		startDrag: drag.startDrag,
		dragTo: drag.dragTo,
		endDrag: drag.endDrag,
	};
}

// Creating it touches nothing, so the server can import it.
export const sidebar = createSidebar();
