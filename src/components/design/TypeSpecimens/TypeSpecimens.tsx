import {
	GallerySection,
	SpecimenRow,
	SpecimenRows,
} from "#/components/design/GallerySection/GallerySection.tsx";
import styles from "./TypeSpecimens.module.css";

const SAMPLE = "Compare package versions across ecosystems";

export function TypeSpecimens() {
	return (
		<GallerySection id="type" source="--text-* --weight-* --font-*">
			<SpecimenRows>
				<SpecimenRow label="--text-caption">
					<span className={styles.caption}>
						12 files changed · 3 advisories
					</span>
				</SpecimenRow>
				<SpecimenRow label="--text-body">
					<span className={styles.body}>{SAMPLE}</span>
				</SpecimenRow>
				<SpecimenRow label="--text-title">
					<span className={styles.title}>1,284 lines</span>
				</SpecimenRow>
				<SpecimenRow label="--text-display --font-display">
					<span className={styles.display}>diffpack</span>
				</SpecimenRow>
				<SpecimenRow label="--text-display-hero --font-display">
					<span className={styles.hero}>diffpack</span>
				</SpecimenRow>
				<SpecimenRow label="--weight-regular">
					<span className={styles.regular}>{SAMPLE}</span>
				</SpecimenRow>
				<SpecimenRow label="--weight-medium">
					<span className={styles.medium}>{SAMPLE}</span>
				</SpecimenRow>
				<SpecimenRow label="--weight-strong">
					<span className={styles.strong}>{SAMPLE}</span>
				</SpecimenRow>
				<SpecimenRow label="--font-mono">
					<span className={styles.mono}>
						packages/react/index.js 18.3.1 → 19.0.0
					</span>
				</SpecimenRow>
				<SpecimenRow label="--font-display --weight-display">
					<span className={styles.displayFont}>Miriam Libre</span>
				</SpecimenRow>
				<SpecimenRow label="--tracking-caps uppercase">
					<span className={styles.overline}>Vulnerabilities</span>
				</SpecimenRow>
				<SpecimenRow label="field label + detail">
					<span className={styles.field}>
						<span className={styles.fieldLabel}>From version</span>
						<span className={styles.detail}>Published 3 months ago</span>
					</span>
				</SpecimenRow>
				<SpecimenRow label="--leading-normal">
					<span className={styles.prose}>
						The diff is computed in your browser. Package contents never reach
						the server, and a cached diff is only looked up by its id.
					</span>
				</SpecimenRow>
			</SpecimenRows>
		</GallerySection>
	);
}
