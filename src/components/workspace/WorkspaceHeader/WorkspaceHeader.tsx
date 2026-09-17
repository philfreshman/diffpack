import { IconButton } from "#/components/ui/IconButton/IconButton.tsx";
import { SidebarIcon } from "#/components/ui/icons.tsx";
import { requireAdapter } from "#/lib/registries/index.ts";
import { toggleTreeCollapsed } from "#/lib/tree/prefs.ts";
import type { DiffSlug } from "#/lib/url/slug.ts";
import { PackageCombobox } from "../PackageCombobox/PackageCombobox.tsx";
import { VersionControls } from "../VersionControls/VersionControls.tsx";
import styles from "./WorkspaceHeader.module.css";

/**
 * Always mounted, whatever the URL says: the header is how a comparison is
 * assembled, so it exists before there is anything to compare — package, two
 * versions, then Compare, left to right.
 *
 * It is the bar beside the sidebar, not over it, so it carries no wordmark: the
 * sidebar's registry switcher is the way out of the workspace. What it does
 * carry is the way back into a shut sidebar, shown only while it is shut.
 */
export function WorkspaceHeader({ slug }: { slug: DiffSlug }) {
	const adapter = requireAdapter(slug.registry);

	return (
		<header className={styles.header}>
			<IconButton
				className={styles.expand}
				aria-label="Expand sidebar"
				title="Expand sidebar"
				onClick={() => toggleTreeCollapsed(document)}
			>
				<SidebarIcon width="16" height="16" />
			</IconButton>
			<div className={styles.controls}>
				<PackageCombobox adapter={adapter} selected={slug.package} />
				<VersionControls adapter={adapter} slug={slug} />
			</div>
		</header>
	);
}
