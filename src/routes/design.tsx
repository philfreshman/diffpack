import { createFileRoute, notFound } from "@tanstack/react-router";
import { DesignGallery } from "#/components/design/DesignGallery/DesignGallery.tsx";

const GALLERY_IS_PUBLISHED =
	import.meta.env.DEV ||
	import.meta.env.VITE_DIFFPACK_DESIGN_GALLERY === "true";

export const Route = createFileRoute("/design")({
	beforeLoad: () => {
		if (!GALLERY_IS_PUBLISHED) throw notFound();
	},
	head: () => ({
		meta: [
			{ title: "Design system | diffpack" },
			{ name: "robots", content: "noindex" },
		],
	}),
	component: DesignGallery,
});
