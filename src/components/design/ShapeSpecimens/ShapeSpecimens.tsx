import {
	GallerySection,
	SpecimenCell,
	SpecimenGrid,
	SpecimenGroup,
} from "#/components/design/GallerySection/GallerySection.tsx";
import styles from "./ShapeSpecimens.module.css";

const RADII = [
	{ token: "--radius-tag", className: styles.radiusTag },
	{ token: "--radius-control", className: styles.radiusControl },
	{ token: "--radius-surface", className: styles.radiusSurface },
	{ token: "--radius-popover", className: styles.radiusPopover },
	{ token: "--radius-tile", className: styles.radiusTile },
	{ token: "--radius-pill", className: styles.radiusPill },
];

const BORDERS = [
	{ token: "--border-width", className: styles.borderHairline },
	{ token: "--border-width-strong", className: styles.borderStrong },
	{ token: "--border-width-accent", className: styles.borderAccent },
];

export function ShapeSpecimens() {
	return (
		<GallerySection
			id="shape"
			source="--radius-* --border-width-* --focus-ring-* --shadow-popover"
		>
			<SpecimenGroup title="Radius">
				<ShapeGrid shapes={RADII} />
			</SpecimenGroup>
			<SpecimenGroup title="Borders">
				<ShapeGrid shapes={BORDERS} />
			</SpecimenGroup>
			<SpecimenGroup title="Focus and depth">
				<SpecimenGrid>
					<SpecimenCell label="--focus-ring-width --focus-ring-offset">
						<span className={`${styles.box} ${styles.focusRing}`} />
					</SpecimenCell>
					<SpecimenCell label="--shadow-popover">
						<span className={`${styles.box} ${styles.popoverShadow}`} />
					</SpecimenCell>
				</SpecimenGrid>
			</SpecimenGroup>
		</GallerySection>
	);
}

function ShapeGrid({
	shapes,
}: {
	shapes: readonly { token: string; className: string | undefined }[];
}) {
	return (
		<SpecimenGrid>
			{shapes.map(({ token, className }) => (
				<SpecimenCell key={token} label={token}>
					<span className={`${styles.box} ${className}`} />
				</SpecimenCell>
			))}
		</SpecimenGrid>
	);
}
