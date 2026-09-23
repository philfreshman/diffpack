import { TREE_COLLAPSED, TREE_WIDTH } from "#/lib/storage/settings.ts";
import {
	readSetting,
	type SettingStore,
	writeSetting,
} from "#/lib/storage/storedSetting.ts";
import { type DragFrame, dragFrame } from "./gesture.ts";

/**
 * The sidebar, as it stands on `<html>`: how wide it is, whether it is shut,
 * and whether its edge is being dragged or it is snapping shut. The width and
 * the shut state are written there before the first paint (`widthScript.ts`),
 * so the panel never flashes at its default on load, and the stylesheets read
 * all four from there. After that they change only through the actions here: a
 * caller says what it wants done, and never reads the page to work out
 * whether to. What is stored, how it is read and the width's bounds are
 * declared with every other setting in `#/lib/storage/settings.ts`.
 */

/**
 * The width lives in a custom property on `<html>` rather than in React state:
 * the pre-paint script writes it before hydration, and the drag rewrites it
 * without a render. One value, one owner, no flash.
 */
export const WIDTH_PROPERTY = "--tree-panel-width";

/**
 * Shut is an attribute on `<html>`, for the same reason the width is a custom
 * property there: the pre-paint script sets it, the stylesheet hides the panel
 * off it, and the buttons that open and shut it never need a render to agree
 * on which of them is showing.
 */
export const COLLAPSED_ATTRIBUTE = "data-tree-collapsed";

/** For the length of a drag: the stylesheet stands the edge's button down. */
const DRAGGING_ATTRIBUTE = "data-tree-dragging";

/** While the panel animates shut; the stylesheet does the animating. */
const SNAPPING_ATTRIBUTE = "data-tree-snapping";

/** How long that takes: `--duration-fast`, which the stylesheet transitions over. */
const SNAP_MS = 150;

interface SidebarOptions {
	/** Whose `<html>` carries the sidebar: the page's own, unless handed another. */
	document?: Document;
	/** Where it is kept between visits: `localStorage`, unless handed another. */
	store?: SettingStore;
	/** Calls `then` once `ms` have passed: `setTimeout`, unless handed another. */
	after?: (ms: number, then: () => void) => void;
}

/**
 * A factory over the document, the store and the clock, so the sidebar's own
 * behaviour can be tested against ones the test controls. The page uses
 * `sidebar`, below.
 */
export function createSidebar({
	document: page,
	store,
	after = (ms, then) => setTimeout(then, ms),
}: SidebarOptions = {}) {
	const listeners = new Set<() => void>();
	/** The width last chosen; read from the store the first time it is asked for. */
	let chosen: number | undefined;
	/**
	 * The snap under way, if there is one. Each snap is a new object, so the
	 * timer of one that has since been settled knows to leave the panel be.
	 */
	let snap: object | null = null;

	/** Looked up as each action runs: there is no document on the server. */
	const root = () => (page ?? document).documentElement;

	function mark(attribute: string, on: boolean): void {
		root().toggleAttribute(attribute, on);
	}

	function showWidth(width: number): void {
		root().style.setProperty(WIDTH_PROPERTY, `${width}px`);
	}

	/**
	 * The width last chosen, by a drag let go within bounds or a nudge — not
	 * one a drag is passing through, which nobody has chosen yet.
	 */
	function width(): number {
		chosen ??= readSetting(TREE_WIDTH, store);

		return chosen;
	}

	/** Calls `listener` whenever `width` changes, until the returned function is called. */
	function subscribe(listener: () => void): () => void {
		listeners.add(listener);

		return () => listeners.delete(listener);
	}

	/** Sets the width outright, within bounds, and keeps it for the next visit. */
	function resize(next: number): void {
		chosen = TREE_WIDTH.clamp(next);
		showWidth(chosen);
		writeSetting(TREE_WIDTH, chosen, store);
		for (const listener of listeners) listener();
	}

	/**
	 * Opening or shutting settles a snap under way first — the way back in is
	 * offered the moment a snap starts, not once it ends. Asked for what it
	 * already is, the panel is left alone and nothing is stored.
	 */
	function setShut(shut: boolean): void {
		settleSnap();
		if (root().hasAttribute(COLLAPSED_ATTRIBUTE) === shut) return;
		mark(COLLAPSED_ATTRIBUTE, shut);
		writeSetting(TREE_COLLAPSED, shut, store);
	}

	function open(): void {
		setShut(false);
	}

	function close(): void {
		setShut(true);
	}

	/** The edge is taken hold of. */
	function startDrag(): void {
		mark(DRAGGING_ATTRIBUTE, true);
	}

	/**
	 * One frame of the drag, with the edge at `edge`: the panel's box follows
	 * it, but this is not yet a width anyone chose. Says how the panel's
	 * content should look there.
	 */
	function dragTo(edge: number): DragFrame {
		const frame = dragFrame(edge);
		showWidth(frame.width);

		return frame;
	}

	/**
	 * The edge is let go at `edge`: at or above the minimum that is the width,
	 * and anywhere past it the panel snaps shut.
	 */
	function endDrag(edge: number): void {
		mark(DRAGGING_ATTRIBUTE, false);
		if (dragFrame(edge).collapses) snapShut();
		else resize(edge);
	}

	/** Animates the panel out, then shuts it. */
	function snapShut(): void {
		const current = {};
		snap = current;
		mark(SNAPPING_ATTRIBUTE, true);
		after(SNAP_MS, () => {
			if (snap === current) close();
		});
	}

	/**
	 * Ends a snap under way, at the width the panel had before the drag:
	 * reopening should give back the panel that was there, not the sliver it
	 * was dragged down to.
	 */
	function settleSnap(): void {
		if (!snap) return;
		snap = null;
		showWidth(width());
		mark(SNAPPING_ATTRIBUTE, false);
	}

	return {
		open,
		close,
		resize,
		width,
		subscribe,
		startDrag,
		dragTo,
		endDrag,
	};
}

/**
 * The page's sidebar. Creating it touches nothing, so the server can import
 * it: every action runs in a handler or an effect, where there is a document.
 */
export const sidebar = createSidebar();
