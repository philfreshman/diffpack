import type { CSSProperties } from "react";
import {
	GallerySection,
	SpecimenGroup,
	SpecimenRow,
	SpecimenRows,
} from "#/components/design/GallerySection/GallerySection.tsx";
import styles from "./SpacingSpecimens.module.css";

const GAPS = [
	"--gap-tight",
	"--gap-inline",
	"--gap-stack",
	"--gap-group",
	"--gap-section",
];

const PADDINGS = [
	"--padding-popover",
	"--padding-control-x",
	"--padding-surface-y",
	"--padding-surface-x",
	"--padding-button-x",
];

const SIZES = ["--control-height"];

export function SpacingSpecimens() {
	return (
		<GallerySection id="spacing" source="--gap-* --padding-* --control-height">
			<SpacingGroup title="Gaps" tokens={GAPS} />
			<SpacingGroup title="Padding" tokens={PADDINGS} />
			<SpacingGroup title="Size" tokens={SIZES} />
		</GallerySection>
	);
}

function SpacingGroup({
	title,
	tokens,
}: {
	title: string;
	tokens: readonly string[];
}) {
	return (
		<SpecimenGroup title={title}>
			<SpecimenRows>
				{tokens.map((token) => (
					<SpecimenRow key={token} label={token}>
						<span
							className={styles.bar}
							style={{ "--bar-length": `var(${token})` } as CSSProperties}
						/>
					</SpecimenRow>
				))}
			</SpecimenRows>
		</SpecimenGroup>
	);
}
