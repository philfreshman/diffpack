export const GALLERY_SECTIONS = [
	{ id: "type", title: "Type" },
	{ id: "spacing", title: "Spacing" },
	{ id: "shape", title: "Shape" },
	{ id: "colour", title: "Colour" },
	{ id: "primitives", title: "Primitives" },
] as const;

export type GallerySectionId = (typeof GALLERY_SECTIONS)[number]["id"];

export function sectionTitle(id: GallerySectionId): string {
	return GALLERY_SECTIONS.find((section) => section.id === id)?.title ?? id;
}
