import type { PackagePath } from "./types.ts";

export const singleSegmentPath: PackagePath = {
	parse(segments) {
		return {
			name: segments[0] ?? "",
			rest: segments.slice(1),
		};
	},

	toSegments(name) {
		return name ? [name] : [];
	},
};
