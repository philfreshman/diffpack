import { useSyncExternalStore } from "react";
import { IconButton } from "#/components/ui/IconButton/IconButton.tsx";
import { SidebarIcon } from "#/components/ui/icons.tsx";
import { requireAdapter } from "#/lib/registries/index.ts";
import { sidebar } from "#/lib/tree/sidebar.ts";
import type { DiffSlug } from "#/lib/url/slug.ts";
import { PackageCombobox } from "../PackageCombobox/PackageCombobox.tsx";
import { VersionControls } from "../VersionControls/VersionControls.tsx";
import styles from "./WorkspaceHeader.module.css";

export function WorkspaceHeader({ slug }: { slug: DiffSlug }) {
	const adapter = requireAdapter(slug.registry);
	const collapsed = useSyncExternalStore(
		sidebar.subscribe,
		sidebar.collapsed,
		() => false,
	);

	return (
		<header className={styles.header}>
			<IconButton
				className={styles.toggle}
				aria-label="Toggle sidebar"
				aria-expanded={!collapsed}
				title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
				onClick={() => sidebar.toggle()}
			>
				<SidebarIcon className={styles.sidebarIcon} width="16" height="16" />
			</IconButton>
			<div className={styles.controls}>
				<PackageCombobox adapter={adapter} selected={slug.package} />
				<VersionControls adapter={adapter} slug={slug} />
			</div>
		</header>
	);
}
