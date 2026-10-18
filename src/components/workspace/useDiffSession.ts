import { useSelector } from "@tanstack/react-store";
import { useEffect } from "react";
import {
	type DiffSessionState,
	diffSession,
} from "#/lib/session/diffSession.ts";
import type { DiffSlug } from "#/lib/url/slug.ts";

export function useDiffSession(
	slug: DiffSlug,
	ignoreWhitespace: boolean | null,
): DiffSessionState {
	const state = useSelector(diffSession.store, (it) => it);

	useEffect(() => {
		diffSession.follow(slug);
	}, [slug]);

	useEffect(() => {
		if (ignoreWhitespace !== null)
			diffSession.answerWhitespace(ignoreWhitespace);
	}, [ignoreWhitespace]);

	return state;
}
