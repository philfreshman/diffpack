import { useEffect, useState } from "react";
import { readAppliedTheme, type ResolvedTheme } from "#/lib/theme.ts";

/** `null` until mounted, to avoid a hydration mismatch; watched because the toggle changes it in place. */
export function useResolvedTheme(): ResolvedTheme | null {
	const [theme, setTheme] = useState<ResolvedTheme | null>(null);

	useEffect(() => {
		const read = () => setTheme(readAppliedTheme(document));
		read();

		const observer = new MutationObserver(read);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["data-theme"],
		});

		return () => observer.disconnect();
	}, []);

	return theme;
}
