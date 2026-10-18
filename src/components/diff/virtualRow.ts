import type { CSSProperties, Ref } from "react";

export interface VirtualRowProps {
	index: number;
	style: CSSProperties;
	ref: Ref<HTMLTableRowElement>;
}
