import { useLocation, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import {
	formatLineAnchor,
	type LineAnchor,
	parseLineAnchor,
} from "#/lib/diff/lineAnchor.ts";
import type { RegistryAdapter } from "#/lib/registries/types.ts";
import { buildPath, type DiffSlug } from "#/lib/url/slug.ts";

export interface LineLink {
	anchorIn(path: string): LineAnchor | null;
	select(anchor: LineAnchor): void;
}

export function useLineLink(
	adapter: RegistryAdapter,
	slug: DiffSlug,
): LineLink {
	const navigate = useNavigate();
	const hash = useLocation({ select: (location) => location.hash });
	const anchor = useMemo(() => parseLineAnchor(hash), [hash]);

	const anchorIn = useCallback(
		(path: string) => (path === slug.file ? anchor : null),
		[anchor, slug.file],
	);
	const select = useCallback(
		(line: LineAnchor) => {
			navigate({
				to: buildPath(adapter, slug),
				hash: formatLineAnchor(line),
				replace: true,
			});
		},
		[navigate, adapter, slug],
	);

	return { anchorIn, select };
}
