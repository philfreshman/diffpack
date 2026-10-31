import { DotsVerticalIcon } from "#/components/ui/icons.tsx";
import {
	ChoiceOption,
	type FoldOutSide,
	FoldOutOption,
	OptionsMenu,
	ToggleOption,
} from "#/components/ui/OptionsMenu/OptionsMenu.tsx";
import { TREE_POSITIONS, type TreePosition } from "#/lib/tree/position.ts";
import styles from "./TreeMenu.module.css";

const POSITION_LABELS: Record<TreePosition, string> = {
	left: "Left",
	right: "Right",
};

const AWAY_FROM_EDGE: Record<TreePosition, FoldOutSide> = {
	left: "right",
	right: "left",
};

export interface TreeMenuProps {
	onlyModified: boolean;
	onOnlyModifiedChange(onlyModified: boolean): void;
	lineCounts: boolean;
	onLineCountsChange(lineCounts: boolean): void;
	position: TreePosition;
	onPositionChange(position: TreePosition): void;
}
export function TreeMenu({
	onlyModified,
	onOnlyModifiedChange,
	lineCounts,
	onLineCountsChange,
	position,
	onPositionChange,
}: TreeMenuProps) {
	const foldOutSide = AWAY_FROM_EDGE[position];

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
			<ToggleOption
				label="Line counts"
				on={lineCounts}
				onChange={onLineCountsChange}
			/>

			<FoldOutOption
				label="Position"
				value={POSITION_LABELS[position]}
				side={foldOutSide}
				testId="position"
			>
				{TREE_POSITIONS.map((choice) => (
					<ChoiceOption
						key={choice}
						label={POSITION_LABELS[choice]}
						chosen={position === choice}
						onChoose={() => onPositionChange(choice)}
						closesMenu
					/>
				))}
			</FoldOutOption>
		</OptionsMenu>
	);
}
