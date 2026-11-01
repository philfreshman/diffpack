import { useSetting } from "#/components/storage/useSetting.ts";
import {
	AUTOHIDE_SCROLLBAR,
	FILE_LAYOUT,
	IGNORE_WHITESPACE,
	SHOW_SIGNS,
	SPLIT_VIEW,
} from "#/lib/storage/settings.ts";

export function useViewerSettings() {
	const whitespace = useSetting(IGNORE_WHITESPACE);
	const split = useSetting(SPLIT_VIEW);
	const signs = useSetting(SHOW_SIGNS);
	const autohide = useSetting(AUTOHIDE_SCROLLBAR);
	const layout = useSetting(FILE_LAYOUT);

	return { whitespace, split, signs, autohide, layout };
}
