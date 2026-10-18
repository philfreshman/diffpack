import { Link } from "@tanstack/react-router";
import { CheckIcon, ChevronsUpDownIcon } from "#/components/ui/icons.tsx";
import {
	Menu,
	MenuLinkItem,
	MenuSeparator,
} from "#/components/ui/Menu/Menu.tsx";
import { registryAdapters } from "#/lib/registries/index.ts";
import type { RegistryAdapter } from "#/lib/registries/types.ts";
import styles from "./RegistrySwitcher.module.css";

export function RegistrySwitcher({ adapter }: { adapter: RegistryAdapter }) {
	return (
		<Menu
			label={`Registry: ${adapter.label}. Switch registry`}
			triggerClassName={styles.trigger}
			trigger={
				<>
					<span className={styles.label}>{adapter.label}</span>
					<ChevronsUpDownIcon
						className={styles.chevrons}
						width="16"
						height="16"
					/>
				</>
			}
		>
			{registryAdapters.map((other) => (
				<MenuLinkItem
					key={other.id}
					render={<Link to="/$registry" params={{ registry: other.id }} />}
				>
					<span className={styles.label}>{other.label}</span>
					{other.id === adapter.id && <CheckIcon width="16" height="16" />}
				</MenuLinkItem>
			))}
			<MenuSeparator />
			<MenuLinkItem render={<Link to="/" />}>All registries</MenuLinkItem>
		</Menu>
	);
}
