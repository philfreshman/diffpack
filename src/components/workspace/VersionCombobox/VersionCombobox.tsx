import { useEffect, useState } from "react";
import { Combobox } from "#/components/ui/Combobox/Combobox.tsx";
import { DownloadIcon } from "#/components/ui/icons.tsx";
import styles from "./VersionCombobox.module.css";

export interface VersionComboboxProps {
	label: string;
	versions: readonly string[];
	value: string;
	onChange(version: string): void;
	loading?: boolean;
	unavailable?: boolean;
	downloadUrl?: string;
}

function placeholderFor(loading: boolean, unavailable: boolean): string {
	if (loading) return "Loading…";
	if (unavailable) return "Versions unavailable";
	return "Select version";
}

// No `onSubmitText`: unlike package search, only listed versions are valid.
export function VersionCombobox({
	label,
	versions,
	value,
	onChange,
	loading = false,
	unavailable = false,
	downloadUrl,
}: VersionComboboxProps) {
	const [inputValue, setInputValue] = useState(value);

	useEffect(() => setInputValue(value), [value]);

	return (
		<div className={styles.field}>
			<span className={styles.labelRow}>
				<span className={styles.label}>{label}</span>
				{downloadUrl ? (
					<a
						className={styles.download}
						href={downloadUrl}
						aria-label={`Download ${value}`}
						title="Download package"
						rel="noopener noreferrer"
					>
						<DownloadIcon width="14" height="14" />
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
				placeholder={placeholderFor(loading, unavailable)}
				disabled={!loading && versions.length === 0}
			/>
		</div>
	);
}
