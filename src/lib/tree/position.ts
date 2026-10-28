export const TREE_POSITIONS = ["left", "right"] as const;

export type TreePosition = (typeof TREE_POSITIONS)[number];
