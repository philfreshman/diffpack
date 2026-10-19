import { useEffect, useState } from "react";
import { Combobox } from "#/components/ui/Combobox/Combobox.tsx";
import { DownloadIcon, ExternalLinkIcon } from "#/components/ui/icons.tsx";
import type { VersionLinkCopy } from "#/lib/registries/types.ts";
import styles from "./VersionCombobox.module.css";

export interface VersionComboboxProps {
	label: string;
	versions: readonly string[];
	value: string;
	onChange(version: string): void;
	loading?: boolean;
	downloadUrl?: string;
	linkCopy?: VersionLinkCopy;
}

const DOWNLOAD_LINK: VersionLinkCopy = {
	labelPrefix: "Download",
	title: "Download package",
	opens: "download",
};

const LINK_ICONS = { download: DownloadIcon, page: ExternalLinkIcon };

// No `onSubmitText`: unlike package search, only listed versions are valid.
export function VersionCombobox({
	label,
	versions,
	value,
	onChange,
	loading = false,
	downloadUrl,
	linkCopy = DOWNLOAD_LINK,
}: VersionComboboxProps) {
	const [inputValue, setInputValue] = useState(value);

	useEffect(() => setInputValue(value), [value]);

	const LinkIcon = LINK_ICONS[linkCopy.opens];

	return (
		<div className={styles.field}>
			<span className={styles.labelRow}>
				<span className={styles.label}>{label}</span>
				{downloadUrl ? (
					<a
						className={styles.download}
						href={downloadUrl}
						aria-label={`${linkCopy.labelPrefix} ${value}`}
						title={linkCopy.title}
						data-opens={linkCopy.opens}
						rel="noopener noreferrer"
					>
						<LinkIcon width="14" height="14" />
					</a>
				) : null}
			</span>
			<Combobox
				label={label}
				items={versions}
				inputValue={inputValue}
				onInputValueChange={setInputValue}
				onSelect={onChange}
				itemToText={(version) => version}
				// Typed filter text is dropped on close, so the field shows the selection.
				onOpenChange={(open) => {
					if (!open) setInputValue(value);
				}}
				// The input holds the selection on open; that must not filter the list.
				filter={(version, query) =>
					query === value || version.toLowerCase().includes(query.toLowerCase())
				}
				loading={loading}
				loadingMessage="Loading versions…"
				emptyMessage={versions.length ? "No matching versions" : "No versions"}
				placeholder={loading ? "Loading…" : "Select version"}
				disabled={!loading && versions.length === 0}
			/>
		</div>
	);
}
