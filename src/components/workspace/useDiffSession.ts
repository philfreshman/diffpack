import { useSelector } from "@tanstack/react-store";
import { useEffect } from "react";
import {
	type DiffSessionState,
	diffSession,
} from "#/lib/session/diffSession.ts";
import type { DiffSlug } from "#/lib/url/slug.ts";

/**
 * Binds the URL to the engine: an address holding a package and two versions
 * *is* the request for a comparison, and the file segment is the request for
 * one file of it. Nothing else starts the engine — a deep link, a Compare
 * click and the back button are the same event by construction.
 *
 * It only passes things on. The session is told what the URL says and what
 * the whitespace answer is, each as it changes, and works out for itself what
 * to build and when a file can open — whichever of the two arrives first.
 */
export function useDiffSession(
	slug: DiffSlug,
	ignoreWhitespace: boolean | null,
): DiffSessionState {
	const state = useSelector(diffSession.store, (it) => it);

	useEffect(() => {
		diffSession.follow(slug);
	}, [slug]);

	// `null` is not an answer yet, only the absence of one: there is nothing
	// to pass on until the stored answer has been read.
	useEffect(() => {
		if (ignoreWhitespace !== null)
			diffSession.answerWhitespace(ignoreWhitespace);
	}, [ignoreWhitespace]);

	return state;
}
