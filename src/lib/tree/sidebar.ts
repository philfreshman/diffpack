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

interface SidebarOptions {
	document?: Document;
	store?: SettingStore;
	after?: (ms: number, then: () => void) => void;
}

export function createSidebar({
	document: page,
	store,
	after = (ms, then) => setTimeout(then, ms),
}: SidebarOptions = {}) {
	const listeners = new Set<() => void>();
	let chosen: number | undefined;
	let placed: TreePosition | undefined;
	// A fresh object per snap, so the timer of a settled snap knows it is stale.
	let snap: object | null = null;

	// Looked up per action: there is no document on the server.
	const root = () => (page ?? document).documentElement;

	function mark(attribute: string, on: boolean): void {
		root().toggleAttribute(attribute, on);
	}

	function showWidth(width: number): void {
		root().style.setProperty(WIDTH_PROPERTY, `${width}px`);
	}

	function width(): number {
		chosen ??= readSetting(TREE_WIDTH, store);

		return chosen;
	}

	function position(): TreePosition {
		placed ??= readSetting(TREE_POSITION, store);

		return placed;
	}

	function showPosition(next: TreePosition): void {
		if (next === TREE_POSITION.fallback)
			root().removeAttribute(POSITION_ATTRIBUTE);
		else root().setAttribute(POSITION_ATTRIBUTE, next);
	}

	function place(next: TreePosition): void {
		placed = next;
		showPosition(next);
		writeSetting(TREE_POSITION, next, store);
		notify();
	}

	function notify(): void {
		for (const listener of listeners) listener();
	}

	function subscribe(listener: () => void): () => void {
		listeners.add(listener);

		return () => listeners.delete(listener);
	}

	// Rounded: under browser zoom a drag can end between two pixels.
	function resize(next: number): void {
		chosen = TREE_WIDTH.clamp(Math.round(next));
		showWidth(chosen);
		writeSetting(TREE_WIDTH, chosen, store);
		notify();
	}

	// Settles a snap first: the panel can be reopened the moment a snap starts.
	function setShut(shut: boolean): void {
		settleSnap();
		if (collapsed() === shut) return;
		mark(COLLAPSED_ATTRIBUTE, shut);
		writeSetting(TREE_COLLAPSED, shut, store);
		notify();
	}

	function collapsed(): boolean {
		return root().hasAttribute(COLLAPSED_ATTRIBUTE);
	}

	function open(): void {
		setShut(false);
	}

	function close(): void {
		setShut(true);
	}

	function toggle(): void {
		setShut(!collapsed());
	}

	function startDrag(): void {
		mark(DRAGGING_ATTRIBUTE, true);
	}

	function dragTo(edge: number): DragFrame {
		const frame = dragFrame(edge);
		showWidth(frame.width);

		return frame;
	}

	function endDrag(edge: number): void {
		mark(DRAGGING_ATTRIBUTE, false);
		if (dragFrame(edge).collapses) snapShut();
		else resize(edge);
	}

	function snapShut(): void {
		const current = {};
		snap = current;
		mark(SNAPPING_ATTRIBUTE, true);
		after(SNAP_MS, () => {
			if (snap === current) close();
		});
	}

	// Back to the chosen width, not the sliver the drag left.
	function settleSnap(): void {
		if (!snap) return;
		snap = null;
		showWidth(width());
		mark(SNAPPING_ATTRIBUTE, false);
	}

	return {
		open,
		close,
		toggle,
		collapsed,
		resize,
		width,
		place,
		position,
		subscribe,
		startDrag,
		dragTo,
		endDrag,
	};
}

// Creating it touches nothing, so the server can import it.
export const sidebar = createSidebar();
