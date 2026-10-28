import { DotsVerticalIcon } from "#/components/ui/icons.tsx";
import {
	OptionsMenu,
	ToggleOption,
} from "#/components/ui/OptionsMenu/OptionsMenu.tsx";
import styles from "./TreeMenu.module.css";

export interface TreeMenuProps {
	onlyModified: boolean;
	onOnlyModifiedChange(onlyModified: boolean): void;
}
export function TreeMenu({
	onlyModified,
	onOnlyModifiedChange,
}: TreeMenuProps) {
	return (
		<OptionsMenu
			label="File tree options"
			icon={<DotsVerticalIcon width="16" height="16" />}
			triggerClassName={styles.trigger}
		>
			<ToggleOption
				label="Only modified"
				on={onlyModified}
				onChange={onOnlyModifiedChange}
			/>
		</OptionsMenu>
	);
}
