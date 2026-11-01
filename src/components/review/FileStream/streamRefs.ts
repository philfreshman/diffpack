import type { RefObject } from "react";

export interface StreamRefs {
	scrollerRef: RefObject<HTMLDivElement | null>;
	contentRef: RefObject<HTMLDivElement | null>;
	cardsRef: RefObject<HTMLDivElement | null>;
}
