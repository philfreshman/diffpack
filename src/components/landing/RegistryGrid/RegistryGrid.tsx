import { registryAdapters } from "#/lib/registries/index.ts";
import { RegistryTile } from "../RegistryTile/RegistryTile.tsx";
import styles from "./RegistryGrid.module.css";

export function RegistryGrid() {
	return (
		<ul className={styles.grid}>
			{registryAdapters.map((adapter) => (
				<li key={adapter.id}>
					<RegistryTile adapter={adapter} />
				</li>
			))}
		</ul>
	);
}
