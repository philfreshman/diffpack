import { ColourSwatches } from "#/components/design/ColourSwatches/ColourSwatches.tsx";
import { GALLERY_SECTIONS } from "#/components/design/gallerySections.ts";
import { PrimitiveSpecimens } from "#/components/design/PrimitiveSpecimens/PrimitiveSpecimens.tsx";
import { ShapeSpecimens } from "#/components/design/ShapeSpecimens/ShapeSpecimens.tsx";
import { SpacingSpecimens } from "#/components/design/SpacingSpecimens/SpacingSpecimens.tsx";
import { TypeSpecimens } from "#/components/design/TypeSpecimens/TypeSpecimens.tsx";
import { ThemeToggle } from "#/components/theme/ThemeToggle/ThemeToggle.tsx";
import styles from "./DesignGallery.module.css";

export function DesignGallery() {
	return (
		<>
			<ThemeToggle />
			<main className={styles.page} data-testid="design-gallery">
				<header className={styles.header}>
					<h1 className={styles.title}>diffpack design system</h1>
					<p className={styles.summary}>
						Role tokens from src/styles/globals.css and the primitives in
						src/components/ui, in the current theme.
					</p>
					<nav aria-label="Sections">
						<ul className={styles.sectionLinks}>
							{GALLERY_SECTIONS.map(({ id, title }) => (
								<li key={id}>
									<a className={styles.sectionLink} href={`#${id}`}>
										{title}
									</a>
								</li>
							))}
						</ul>
					</nav>
				</header>
				<TypeSpecimens />
				<SpacingSpecimens />
				<ShapeSpecimens />
				<ColourSwatches />
				<PrimitiveSpecimens />
			</main>
		</>
	);
}
