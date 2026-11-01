import type { CSSProperties } from "react";
import {
	GallerySection,
	SpecimenGroup,
	TokenLabel,
} from "#/components/design/GallerySection/GallerySection.tsx";
import styles from "./ColourSwatches.module.css";

const COLOUR_GROUPS = [
	{
		title: "Text",
		tokens: ["--color-foreground", "--color-muted"],
	},
	{
		title: "Surfaces",
		tokens: [
			"--color-canvas",
			"--color-background",
			"--color-surface",
			"--color-surface-hover",
			"--color-selected-surface",
			"--color-input",
		],
	},
	{
		title: "Lines and accent",
		tokens: [
			"--color-border",
			"--color-focus-ring",
			"--color-accent",
			"--color-accent-hover",
			"--color-accent-foreground",
		],
	},
	{
		title: "Meaning",
		tokens: [
			"--color-danger",
			"--color-added",
			"--color-removed",
			"--color-renamed",
		],
	},
	{
		title: "Severity",
		tokens: [
			"--color-severity-critical",
			"--color-severity-high",
			"--color-severity-moderate",
			"--color-severity-low",
			"--color-severity-unknown",
		],
	},
	{
		title: "Registries",
		tokens: [
			"--registry-npm",
			"--registry-crates",
			"--registry-go",
			"--registry-pypi",
			"--registry-composer",
		],
	},
];

export function ColourSwatches() {
	return (
		<GallerySection id="colour" source="--color-* --registry-*">
			{COLOUR_GROUPS.map(({ title, tokens }) => (
				<SpecimenGroup key={title} title={title}>
					<ul className={styles.swatches}>
						{tokens.map((token) => (
							<Swatch key={token} token={token} />
						))}
					</ul>
				</SpecimenGroup>
			))}
		</GallerySection>
	);
}

function Swatch({ token }: { token: string }) {
	return (
		<li className={styles.swatch}>
			<span
				className={styles.chip}
				style={{ "--swatch": `var(${token})` } as CSSProperties}
			/>
			<TokenLabel>{token}</TokenLabel>
		</li>
	);
}
