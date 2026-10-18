import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { GA_MEASUREMENT_ID } from "#/lib/analytics.ts";

declare global {
	interface Window {
		gtag?: (...args: unknown[]) => void;
		dataLayer?: IArguments[];
	}
}

// Measured on a production build, where the title lands about a second after
// the click. `vite dev` is far faster, so do not tune this against dev.
const TITLE_GRACE_MS = 3_000;

// The inline gtag `config` reports only the first page; this reports every
// client-side navigation after it, so it skips the first location.
export function Analytics() {
	const href = useRouterState({
		select: (state) => state.location.href,
	});
	const reported = useRef<string | null>(null);

	useEffect(() => {
		if (reported.current === null) {
			reported.current = href;
			return;
		}
		if (reported.current === href) return;
		reported.current = href;

		// The new `<title>` is written some time after this commit, so wait for it,
		// up to TITLE_GRACE_MS (the case where the title does not change).
		const before = document.title;
		let sent = false;
		const send = () => {
			if (sent) return;
			sent = true;
			observer.disconnect();
			clearTimeout(deadline);
			window.gtag?.("event", "page_view", {
				page_location: window.location.href,
				page_path: href,
				page_title: document.title,
				send_to: GA_MEASUREMENT_ID,
			});
		};

		// The head also changes for other reasons, so only a new title counts.
		const observer = new MutationObserver(() => {
			if (document.title !== before) send();
		});
		observer.observe(document.head, {
			characterData: true,
			childList: true,
			subtree: true,
		});
		const deadline = setTimeout(send, TITLE_GRACE_MS);

		// A navigation that beats the title is still reported, not dropped.
		return send;
	}, [href]);

	return null;
}
