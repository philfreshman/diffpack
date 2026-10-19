import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "#/components/ui/Button/Button.tsx";
import type { RegistryAdapter } from "#/lib/registries/types.ts";
import { buildPath, type DiffSlug } from "#/lib/url/slug.ts";
import { diffSession } from "#/lib/session/diffSession.ts";
import { resolveSelection } from "../versionSelection.ts";
import { useVersions } from "../useVersions.ts";
import { VersionCombobox } from "../VersionCombobox/VersionCombobox.tsx";
import styles from "./VersionControls.module.css";

// Choosing a version does not write the URL; only Compare does, because the
// URL starts the engine and two archive downloads.
export function VersionControls({
	adapter,
	slug,
}: {
	adapter: RegistryAdapter;
	slug: DiffSlug;
}) {
	const navigate = useNavigate();
	const { list, loading, error } = useVersions(adapter, slug.package);
	const [selection, setSelection] = useState(() =>
		resolveSelection(list, slug),
	);

	// A selection made here lasts until the URL or the list changes.
	useEffect(() => {
		setSelection(resolveSelection(list, { from: slug.from, to: slug.to }));
	}, [list, slug.from, slug.to]);

	const { from, to } = selection;
	const ready = Boolean(slug.package && from && to);
	// Keeps the open file: a path missing from the new pair reads as removed.
	const target = buildPath(adapter, {
		package: slug.package,
		from,
		to,
		file: slug.file,
	});

	// The session dedupes prefetches and swallows their failures.
	function prefetch() {
		if (!ready) return;
		diffSession.prefetch({ registry: adapter.id, pkg: slug.package, from, to });
	}

	return (
		<>
			<VersionCombobox
				label="From Version"
				versions={list}
				value={from}
				onChange={(version) =>
					setSelection((current) => ({ ...current, from: version }))
				}
				loading={loading}
				unavailable={error !== null}
				downloadUrl={from ? adapter.downloadUrl(slug.package, from) : undefined}
				linkCopy={adapter.versionLink}
			/>
			<VersionCombobox
				label="To Version"
				versions={list}
				value={to}
				onChange={(version) =>
					setSelection((current) => ({ ...current, to: version }))
				}
				loading={loading}
				unavailable={error !== null}
				downloadUrl={to ? adapter.downloadUrl(slug.package, to) : undefined}
				linkCopy={adapter.versionLink}
			/>
			<Button
				className={styles.compare}
				variant="primary"
				disabled={!ready}
				onClick={() => navigate({ to: target })}
				onMouseEnter={prefetch}
				onFocus={prefetch}
			>
				Compare
			</Button>
		</>
	);
}
