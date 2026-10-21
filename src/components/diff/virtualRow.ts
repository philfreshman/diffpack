import type { CSSProperties, Ref } from "react";
import type { LineAnchor } from "#/lib/diff/lineAnchor.ts";

export interface VirtualRowProps {
	index: number;
	style: CSSProperties;
	ref: Ref<HTMLTableRowElement>;
}

export interface SelectableRowProps {
	selected: boolean;
	onSelectLine(anchor: LineAnchor): void;
}
