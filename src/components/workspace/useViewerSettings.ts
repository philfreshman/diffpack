import { useSetting } from "#/components/storage/useSetting.ts";
import {
	IGNORE_WHITESPACE,
	SHOW_SIGNS,
	SPLIT_VIEW,
} from "#/lib/storage/settings.ts";

export function useViewerSettings() {
	const whitespace = useSetting(IGNORE_WHITESPACE);
	const split = useSetting(SPLIT_VIEW);
	const signs = useSetting(SHOW_SIGNS);

	return { whitespace, split, signs };
}
