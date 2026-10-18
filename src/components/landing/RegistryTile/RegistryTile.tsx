import { Link } from "@tanstack/react-router";
import { ChevronRightIcon } from "#/components/ui/icons.tsx";
import type { RegistryAdapter } from "#/lib/registries/types.ts";
import styles from "./RegistryTile.module.css";

export function RegistryTile({ adapter }: { adapter: RegistryAdapter }) {
	return (
		<Link
			to="/$registry"
			params={{ registry: adapter.id }}
			className={styles.tile}
			data-registry={adapter.id}
			data-testid="registry-tile"
		>
			<h2 className={styles.name}>{adapter.label}</h2>
			<p className={styles.tagline}>{adapter.tagline}</p>
			<span className={styles.explore}>
				Explore
				<ChevronRightIcon className={styles.arrow} width="16" height="16" />
			</span>
		</Link>
	);
}
